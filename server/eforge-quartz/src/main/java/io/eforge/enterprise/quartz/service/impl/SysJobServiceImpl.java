package io.eforge.enterprise.quartz.service.impl;

import java.util.List;
import java.util.LinkedHashSet;
import java.util.Set;
import jakarta.annotation.PostConstruct;
import org.quartz.JobDataMap;
import org.quartz.JobKey;
import org.quartz.JobDetail;
import org.quartz.Trigger;
import org.quartz.TriggerKey;
import org.quartz.spi.MutableTrigger;
import org.quartz.Scheduler;
import org.quartz.SchedulerException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import io.eforge.enterprise.common.constant.ScheduleConstants;
import io.eforge.enterprise.common.exception.job.TaskException;
import io.eforge.enterprise.quartz.domain.SysJob;
import io.eforge.enterprise.quartz.mapper.SysJobMapper;
import io.eforge.enterprise.quartz.service.ISysJobService;
import io.eforge.enterprise.quartz.service.TaskMutationBoundary;
import io.eforge.enterprise.quartz.util.CronUtils;
import io.eforge.enterprise.quartz.util.ScheduleUtils;

/**
 * 定时任务调度信息 服务层
 * 
 * @author ruoyi
 */
@Service
public class SysJobServiceImpl implements ISysJobService
{
    @Autowired
    private Scheduler scheduler;

    @Autowired
    private SysJobMapper jobMapper;

    /**
     * 项目启动时，初始化定时器 主要是防止手动修改数据库导致未同步到定时任务处理（注：不能手动修改数据库ID和任务组名，否则会导致脏数据）
     */
    @PostConstruct
    public void init() throws SchedulerException, TaskException
    {
        scheduler.clear();
        List<SysJob> jobList = jobMapper.selectJobAll();
        for (SysJob job : jobList)
        {
            ScheduleUtils.createScheduleJob(scheduler, job);
        }
    }

    /**
     * 获取quartz调度器的计划任务列表
     * 
     * @param job 调度信息
     * @return
     */
    @Override
    public List<SysJob> selectJobList(SysJob job)
    {
        return jobMapper.selectJobList(job);
    }

    /**
     * 通过调度任务ID查询调度信息
     * 
     * @param jobId 调度任务ID
     * @return 调度任务对象信息
     */
    @Override
    public SysJob selectJobById(Long jobId)
    {
        return jobMapper.selectJobById(jobId);
    }

    /**
     * 暂停任务
     * 
     * @param job 调度信息
     */
    @Override
    @Transactional(rollbackFor = Exception.class)
    public int pauseJob(SysJob job) throws SchedulerException
    {
        Long jobId = job.getJobId();
        SysJob current = jobMapper.selectJobById(jobId);
        if (current == null) return 0;
        String jobGroup = current.getJobGroup();
        job.setStatus(ScheduleConstants.Status.PAUSE.getValue());
        SysJob status = new SysJob(); status.setJobId(jobId); status.setStatus(job.getStatus()); status.setUpdateBy(job.getUpdateBy()); status.setMisfirePolicy(null);
        int rows = jobMapper.updateJob(status);
        if (rows > 0)
        {
            scheduler.pauseJob(ScheduleUtils.getJobKey(jobId, jobGroup));
        }
        return rows;
    }

    /**
     * 恢复任务
     * 
     * @param job 调度信息
     */
    @Override
    @Transactional(rollbackFor = Exception.class)
    public int resumeJob(SysJob job) throws SchedulerException
    {
        Long jobId = job.getJobId();
        SysJob current = jobMapper.selectJobById(jobId);
        if (current == null) return 0;
        String jobGroup = current.getJobGroup();
        job.setStatus(ScheduleConstants.Status.NORMAL.getValue());
        SysJob status = new SysJob(); status.setJobId(jobId); status.setStatus(job.getStatus()); status.setUpdateBy(job.getUpdateBy()); status.setMisfirePolicy(null);
        int rows = jobMapper.updateJob(status);
        if (rows > 0)
        {
            scheduler.resumeJob(ScheduleUtils.getJobKey(jobId, jobGroup));
        }
        return rows;
    }

    /**
     * 删除任务后，所对应的trigger也将被删除
     * 
     * @param job 调度信息
     */
    @Override
    @Transactional(rollbackFor = Exception.class)
    public int deleteJob(SysJob job) throws SchedulerException
    {
        Long jobId = job.getJobId();
        SysJob current = jobMapper.selectJobById(jobId);
        if (current == null) return 0;
        String jobGroup = current.getJobGroup();
        int rows = jobMapper.deleteJobById(jobId);
        if (rows > 0)
        {
            scheduler.deleteJob(ScheduleUtils.getJobKey(jobId, jobGroup));
        }
        return rows;
    }

    /**
     * 批量删除调度信息
     * 
     * @param jobIds 需要删除的任务ID
     * @return 结果
     */
    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteJobByIds(Long[] jobIds) throws SchedulerException
    {
        for (Long jobId : jobIds)
        {
            SysJob job = jobMapper.selectJobById(jobId);
            if (job != null) deleteJob(job);
        }
    }

    /**
     * 任务调度状态修改
     * 
     * @param job 调度信息
     */
    @Override
    @Transactional(rollbackFor = Exception.class)
    public int changeStatus(SysJob job) throws SchedulerException
    {
        int rows = 0;
        String status = job.getStatus();
        if (ScheduleConstants.Status.NORMAL.getValue().equals(status))
        {
            rows = resumeJob(job);
        }
        else if (ScheduleConstants.Status.PAUSE.getValue().equals(status))
        {
            rows = pauseJob(job);
        }
        return rows;
    }

    /**
     * 立即运行任务
     * 
     * @param job 调度信息
     */
    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean run(SysJob job) throws SchedulerException
    {
        boolean result = false;
        Long jobId = job.getJobId();
        SysJob properties = selectJobById(job.getJobId());
        if (properties == null) return false;
        if (job.getJobGroup() != null && !job.getJobGroup().equals(properties.getJobGroup())) return false;
        String jobGroup = properties.getJobGroup();
        // 参数
        JobDataMap dataMap = new JobDataMap();
        dataMap.put(ScheduleConstants.TASK_PROPERTIES, properties);
        dataMap.put(TaskMutationBoundary.MANUAL_RUN, Boolean.TRUE);
        JobKey jobKey = ScheduleUtils.getJobKey(jobId, jobGroup);
        if (scheduler.checkExists(jobKey))
        {
            result = true;
            // Do not enqueue a manual firing from a transaction that can still
            // roll back. The outer task boundary retains its admission lock
            // throughout this callback and actual commit completion.
            if (!TransactionSynchronizationManager.isActualTransactionActive())
                throw new SchedulerException("Manual task execution requires the task transaction boundary.");
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization()
            {
                @Override public void afterCommit()
                {
                    try { scheduler.triggerJob(jobKey, dataMap); }
                    catch (SchedulerException failure)
                    { throw new IllegalStateException("Manual task dispatch is temporarily unavailable."); }
                }
            });
        }
        return result;
    }

    /**
     * 新增任务
     * 
     * @param job 调度信息 调度信息
     */
    @Override
    @Transactional(rollbackFor = Exception.class)
    public int insertJob(SysJob job) throws SchedulerException, TaskException
    {
        job.setStatus(ScheduleConstants.Status.PAUSE.getValue());
        int rows = jobMapper.insertJob(job);
        if (rows > 0)
        {
            ScheduleUtils.createScheduleJob(scheduler, job);
        }
        return rows;
    }

    /**
     * 更新任务的时间表达式
     * 
     * @param job 调度信息
     */
    @Override
    @Transactional(rollbackFor = Exception.class)
    public int updateJob(SysJob job) throws SchedulerException, TaskException
    {
        SysJob properties = selectJobById(job.getJobId());
        int rows = jobMapper.updateJob(job);
        if (rows > 0)
        {
            updateSchedulerJob(job, properties.getJobGroup());
        }
        return rows;
    }

    /**
     * 更新任务
     * 
     * @param job 任务对象
     * @param jobGroup 任务组名
     */
    public void updateSchedulerJob(SysJob job, String jobGroup) throws SchedulerException, TaskException
    {
        Long jobId = job.getJobId();
        JobKey jobKey = ScheduleUtils.getJobKey(jobId, jobGroup);
        JobKey nextKey = ScheduleUtils.getJobKey(jobId, job.getJobGroup());
        if (!jobKey.equals(nextKey) && scheduler.checkExists(nextKey))
        {
            throw new TaskException("Target schedule key already exists.", TaskException.Code.TASK_EXISTS);
        }
        JobDetail previous = scheduler.getJobDetail(jobKey);
        Set<Trigger> previousTriggers = new LinkedHashSet<>();
        Set<TriggerKey> paused = new LinkedHashSet<>();
        if (previous != null)
        {
            previous = (JobDetail) previous.clone();
            for (Trigger trigger : scheduler.getTriggersOfJob(jobKey))
            {
                previousTriggers.add((Trigger) ((MutableTrigger) trigger).clone());
                if (scheduler.getTriggerState(trigger.getKey()) == Trigger.TriggerState.PAUSED) paused.add(trigger.getKey());
            }
        }
        try
        {
            if (previous != null) scheduler.deleteJob(jobKey);
            ScheduleUtils.createScheduleJob(scheduler, job);
        }
        catch (SchedulerException | TaskException | RuntimeException failure)
        {
            // SQL rollback cannot undo RAMJobStore changes. Restore the old
            // payload and saved next deadline, not the attempted update.
            try
            {
                scheduler.deleteJob(nextKey);
                if (previous != null)
                {
                    if (!jobKey.equals(nextKey)) scheduler.deleteJob(jobKey);
                    // Quartz recalculates the first firing when scheduling. Starting
                    // at the saved next deadline prevents replay of an already-fired
                    // occurrence from the original trigger's historical start time.
                    for (Trigger trigger : previousTriggers)
                        if (trigger.getNextFireTime() != null) ((MutableTrigger) trigger).setStartTime(trigger.getNextFireTime());
                    scheduler.scheduleJob(previous, previousTriggers, false);
                    for (TriggerKey trigger : paused) scheduler.pauseTrigger(trigger);
                }
            }
            catch (SchedulerException | RuntimeException recoveryFailure)
            {
                failure.addSuppressed(recoveryFailure);
            }
            throw failure;
        }
    }

    /**
     * 校验cron表达式是否有效
     * 
     * @param cronExpression 表达式
     * @return 结果
     */
    @Override
    public boolean checkCronExpressionIsValid(String cronExpression)
    {
        return CronUtils.isValid(cronExpression);
    }
}
