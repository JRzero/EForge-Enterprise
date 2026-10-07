package io.eforge.enterprise.quartz.service;

import java.util.*;
import java.util.concurrent.locks.ReentrantLock;
import org.quartz.*;
import org.quartz.impl.matchers.GroupMatcher;
import org.quartz.spi.MutableTrigger;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import io.eforge.enterprise.common.constant.ScheduleConstants;
import io.eforge.enterprise.common.utils.bean.BeanUtils;
import io.eforge.enterprise.quartz.domain.SysJob;
import io.eforge.enterprise.quartz.mapper.SysJobMapper;
import io.eforge.enterprise.quartz.util.ScheduleUtils;

/** Approved single-process SQL/RAMJobStore boundary. Never clears unrelated jobs. */
@Component
public class TaskMutationBoundary {
    public static final String MANUAL_RUN = "EFORGE_MANUAL_TASK_RUN";
    private final ReentrantLock lock = new ReentrantLock(true);
    private final Set<Long> recovery = new LinkedHashSet<>();
    private final Scheduler scheduler;
    private final SysJobMapper mapper;
    private final TransactionTemplate transaction;
    public TaskMutationBoundary(Scheduler scheduler, SysJobMapper mapper, PlatformTransactionManager manager) {
        this.scheduler=scheduler;this.mapper=mapper;this.transaction=new TransactionTemplate(manager);
    }
    @FunctionalInterface public interface Operation {Object execute() throws Throwable;}
    private static final class OperationFailure extends RuntimeException {
        OperationFailure(Throwable cause){super(cause);}
    }
    private record Snapshot(JobDetail detail, Set<Trigger> triggers, Set<TriggerKey> paused) {}

    public Object mutate(Object[] arguments, Operation operation) throws Throwable {
        if(TransactionSynchronizationManager.isActualTransactionActive()
                || TransactionSynchronizationManager.isSynchronizationActive())
            throw new SchedulerException("Task mutation cannot join an outer transaction.");
        lock.lockInterruptibly();
        try {
            Set<Long> ids=identifiers(arguments);
            Map<JobKey,Snapshot> snapshots;
            for(Long id:ids)recover(id);
            snapshots=snapshot(ids);
            try {
                // Existing @Transactional service advisors join this transaction.
                // execute returns only after the real manager commits or rolls back.
                return transaction.execute(status->{
                    try {return operation.execute();}
                    catch(Throwable failure){throw new OperationFailure(failure);}
                });
            } catch(Throwable failure) {
                ids.addAll(identifiers(arguments)); // An inserted ID can survive in its input after SQL rollback.
                try {restore(ids,snapshots);}
                catch(Exception restoration){recovery.addAll(ids);failure.addSuppressed(restoration);}
                // A commit/rollback-manager failure can have an uncertain physical
                // outcome. Never infer committed SQL from a successfully restored
                // RAM snapshot: admission must reconstruct from SQL before retry.
                if(!(failure instanceof OperationFailure))recovery.addAll(ids);
                if(failure instanceof OperationFailure wrapped)throw wrapped.getCause();
                throw failure;
            }
        } finally {lock.unlock();}
    }

    /** The lock protects admission only. Already-admitted target invocations may finish. */
    public SysJob admit(SysJob captured, boolean manual) throws SchedulerException {
        if(TransactionSynchronizationManager.isActualTransactionActive())
            throw new SchedulerException("Task execution cannot inspect an uncommitted transaction.");
        lock.lock();
        try {
            if(captured==null || captured.getJobId()==null)throw unavailable();
            recover(captured.getJobId());
            SysJob current;
            try {current=mapper.selectJobById(captured.getJobId());}
            catch(RuntimeException failure){throw unavailable();}
            if(current==null || !sameConfiguration(captured,current)
                    || (!manual && !ScheduleConstants.Status.NORMAL.getValue().equals(current.getStatus())))
                throw new SchedulerException("Task execution rejected: configuration is no longer current.");
            return copy(current);
        } finally {lock.unlock();}
    }

    private static boolean sameConfiguration(SysJob a,SysJob b) {
        return Objects.equals(a.getJobGroup(),b.getJobGroup())
            && Objects.equals(a.getInvokeTarget(),b.getInvokeTarget())
            && Objects.equals(a.getCronExpression(),b.getCronExpression())
            && Objects.equals(a.getConcurrent(),b.getConcurrent())
            && Objects.equals(a.getMisfirePolicy(),b.getMisfirePolicy());
    }
    private static Set<Long> identifiers(Object[] args) {
        Set<Long> ids=new LinkedHashSet<>();
        for(Object argument:args) {
            if(argument instanceof SysJob row && row.getJobId()!=null)ids.add(row.getJobId());
            if(argument instanceof Long[] values)for(Long value:values)if(value!=null)ids.add(value);
        }
        return ids;
    }
    private Set<JobKey> keys(Set<Long> ids) throws SchedulerException {
        Set<JobKey> keys=new LinkedHashSet<>();
        for(JobKey key:scheduler.getJobKeys(GroupMatcher.anyJobGroup()))
            for(Long id:ids)if(key.getName().equals(ScheduleConstants.TASK_CLASS_NAME+id)){keys.add(key);break;}
        return keys;
    }
    private Map<JobKey,Snapshot> snapshot(Set<Long> ids) throws SchedulerException {
        Map<JobKey,Snapshot> values=new LinkedHashMap<>();
        for(JobKey key:keys(ids)) {
            JobDetail detail=(JobDetail)scheduler.getJobDetail(key).clone();
            Object payload=detail.getJobDataMap().get(ScheduleConstants.TASK_PROPERTIES);
            if(payload instanceof SysJob row)detail.getJobDataMap().put(ScheduleConstants.TASK_PROPERTIES,copy(row));
            Set<Trigger> triggers=new LinkedHashSet<>();Set<TriggerKey> paused=new LinkedHashSet<>();
            for(Trigger trigger:scheduler.getTriggersOfJob(key)) {
                triggers.add((Trigger)((MutableTrigger)trigger).clone());
                if(scheduler.getTriggerState(trigger.getKey())==Trigger.TriggerState.PAUSED)paused.add(trigger.getKey());
            }
            values.put(key,new Snapshot(detail,triggers,paused));
        }
        return values;
    }
    private void restore(Set<Long> ids,Map<JobKey,Snapshot> snapshots) throws SchedulerException {
        for(JobKey key:keys(ids))scheduler.deleteJob(key);
        for(Snapshot value:snapshots.values()) {
            for(Trigger trigger:value.triggers())if(trigger.getNextFireTime()!=null)
                ((MutableTrigger)trigger).setStartTime(trigger.getNextFireTime());
            if(value.triggers().isEmpty())scheduler.addJob(value.detail(),true,true);
            else scheduler.scheduleJob(value.detail(),value.triggers(),false);
            for(TriggerKey key:value.paused())scheduler.pauseTrigger(key);
        }
    }
    private void recover(Long id) throws SchedulerException {
        if(!recovery.contains(id))return;
        try {
            SysJob current=mapper.selectJobById(id);
            for(JobKey key:keys(Set.of(id)))scheduler.deleteJob(key);
            if(current!=null)ScheduleUtils.createScheduleJob(scheduler,copy(current));
            recovery.remove(id);
        } catch(Exception failure){throw unavailable();}
    }
    private static SchedulerException unavailable(){return new SchedulerException("Task schedule is temporarily unavailable.");}
    private static SysJob copy(SysJob row) {
        SysJob copy=new SysJob();BeanUtils.copyBeanProp(copy,row);
        if(row.getCreateTime()!=null)copy.setCreateTime(new Date(row.getCreateTime().getTime()));
        if(row.getUpdateTime()!=null)copy.setUpdateTime(new Date(row.getUpdateTime().getTime()));
        copy.setParams(new HashMap<>(row.getParams()));
        return copy;
    }
}
