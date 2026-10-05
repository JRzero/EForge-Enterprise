package io.eforge.enterprise.web.controller.api.v1.monitor;

import java.util.Properties;
import java.util.UUID;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.quartz.*;
import org.quartz.impl.StdSchedulerFactory;
import org.springframework.test.util.ReflectionTestUtils;
import io.eforge.enterprise.common.constant.ScheduleConstants;
import io.eforge.enterprise.quartz.domain.SysJob;
import io.eforge.enterprise.quartz.mapper.SysJobMapper;
import io.eforge.enterprise.quartz.service.impl.SysJobServiceImpl;
import io.eforge.enterprise.quartz.util.ScheduleUtils;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

/** Real RAMJobStore; only the replacement call is fault-injected. No task executes. */
class TaskScheduleReplacementTest {
    Scheduler actual;
    @BeforeEach void scheduler() throws Exception {
        var properties=new Properties();properties.setProperty("org.quartz.scheduler.instanceName","owned-replacement-"+UUID.randomUUID());
        properties.setProperty("org.quartz.scheduler.skipUpdateCheck","true");properties.setProperty("org.quartz.scheduler.makeSchedulerThreadDaemon","true");
        properties.setProperty("org.quartz.threadPool.threadCount","1");properties.setProperty("org.quartz.threadPool.makeThreadsDaemons","true");
        properties.setProperty("org.quartz.jobStore.class","org.quartz.simpl.RAMJobStore");actual=new StdSchedulerFactory(properties).getScheduler();
    }
    @AfterEach void cleanup() throws Exception {if(actual!=null)actual.shutdown(true);}
    static SysJob job(String group,String status,String target) {
        var row=new SysJob();row.setJobId(700001L);row.setJobName("Owned replacement");row.setJobGroup(group);row.setStatus(status);
        row.setInvokeTarget(target);row.setCronExpression("0 0 0 1 1 ? 2099");row.setMisfirePolicy("3");row.setConcurrent("1");return row;
    }
    @ParameterizedTest @CsvSource({"SYSTEM,0","SYSTEM,1","DEFAULT,0","DEFAULT,1"})
    void failedReplacementRetainsOldGroupPayloadTimingAndPauseState(String nextGroup,String status) throws Exception {
        var old=job("SYSTEM",status,"ryTask.ryNoParams()");ScheduleUtils.createScheduleJob(actual,old);
        var oldKey=ScheduleUtils.getJobKey(old.getJobId(),old.getJobGroup());var oldTrigger=actual.getTriggersOfJob(oldKey).get(0);
        var next=job(nextGroup,status,"ryTask.ryParams('replacement')");var faulted=spy(actual);
        doThrow(new SchedulerException("Owned schedule failure")).when(faulted).scheduleJob(any(JobDetail.class),any(Trigger.class));
        var mapper=mock(SysJobMapper.class);when(mapper.selectJobById(old.getJobId())).thenReturn(old);when(mapper.updateJob(next)).thenReturn(1);
        var service=new SysJobServiceImpl();ReflectionTestUtils.setField(service,"scheduler",faulted);ReflectionTestUtils.setField(service,"jobMapper",mapper);
        assertThrows(SchedulerException.class,()->service.updateJob(next));
        assertTrue(actual.checkExists(oldKey),"A failed replacement must retain the original real Quartz job.");
        var restored=actual.getTriggersOfJob(oldKey).get(0);assertEquals(oldTrigger.getKey(),restored.getKey());assertEquals(oldTrigger.getNextFireTime(),restored.getNextFireTime());
        assertEquals(status.equals("1")?Trigger.TriggerState.PAUSED:Trigger.TriggerState.NORMAL,actual.getTriggerState(restored.getKey()));
        assertEquals(old.getInvokeTarget(),((SysJob)actual.getJobDetail(oldKey).getJobDataMap().get(ScheduleConstants.TASK_PROPERTIES)).getInvokeTarget());
        if(!nextGroup.equals("SYSTEM"))assertFalse(actual.checkExists(ScheduleUtils.getJobKey(next.getJobId(),nextGroup)));
    }
    @Test void failureAfterNewJobWasStoredRemovesItAndRestoresPausedOriginal() throws Exception {
        var old=job("SYSTEM","1","ryTask.ryNoParams()");ScheduleUtils.createScheduleJob(actual,old);
        var next=job("DEFAULT","1","ryTask.ryParams('replacement')");var faulted=spy(actual);
        doThrow(new SchedulerException("Owned pause failure")).when(faulted).pauseJob(ScheduleUtils.getJobKey(next.getJobId(),next.getJobGroup()));
        var service=new SysJobServiceImpl();ReflectionTestUtils.setField(service,"scheduler",faulted);
        assertThrows(SchedulerException.class,()->service.updateSchedulerJob(next,"SYSTEM"));
        assertFalse(actual.checkExists(ScheduleUtils.getJobKey(next.getJobId(),"DEFAULT")));
        assertEquals(Trigger.TriggerState.PAUSED,actual.getTriggerState(ScheduleUtils.getTriggerKey(old.getJobId(),"SYSTEM")));
    }
    @Test void targetGroupCollisionDoesNotDestroyEitherSchedule() throws Exception {
        var old=job("SYSTEM","1","ryTask.ryNoParams()");var occupied=job("DEFAULT","0","ryTask.ryParams('occupied')");
        ScheduleUtils.createScheduleJob(actual,old);ScheduleUtils.createScheduleJob(actual,occupied);
        var service=new SysJobServiceImpl();ReflectionTestUtils.setField(service,"scheduler",actual);
        assertThrows(io.eforge.enterprise.common.exception.job.TaskException.class,()->service.updateSchedulerJob(job("DEFAULT","1","ryTask.ryParams('replacement')"),"SYSTEM"));
        for(var row:java.util.List.of(old,occupied))assertEquals(row.getInvokeTarget(),((SysJob)actual.getJobDetail(ScheduleUtils.getJobKey(row.getJobId(),row.getJobGroup())).getJobDataMap().get(ScheduleConstants.TASK_PROPERTIES)).getInvokeTarget());
    }
    public static class CountingJob implements Job {
        static final java.util.concurrent.atomic.AtomicInteger executions=new java.util.concurrent.atomic.AtomicInteger();
        @Override public void execute(JobExecutionContext context){executions.incrementAndGet();}
    }
    @Test void recoveryDoesNotReplayHistoricalStartAfterAnActualFiring() throws Exception {
        CountingJob.executions.set(0);var old=job("SYSTEM","0","ryTask.ryNoParams()");var key=ScheduleUtils.getJobKey(old.getJobId(),old.getJobGroup());
        var detail=JobBuilder.newJob(CountingJob.class).withIdentity(key).build();detail.getJobDataMap().put(ScheduleConstants.TASK_PROPERTIES,old);
        var trigger=TriggerBuilder.newTrigger().withIdentity(ScheduleUtils.getTriggerKey(old.getJobId(),old.getJobGroup()))
            .startAt(new java.util.Date(System.currentTimeMillis()-86400000))
            .withSchedule(CronScheduleBuilder.cronSchedule("0/1 * * * * ?").withMisfireHandlingInstructionDoNothing()).build();
        actual.scheduleJob(detail,trigger);actual.start();long timeout=System.nanoTime()+java.util.concurrent.TimeUnit.SECONDS.toNanos(5);
        while(CountingJob.executions.get()==0&&System.nanoTime()<timeout)Thread.sleep(10);
        assertTrue(CountingJob.executions.get()>0,"The test must observe an actual Quartz firing.");actual.standby();
        var before=actual.getTriggersOfJob(key).get(0);assertNotNull(before.getPreviousFireTime());
        assertTrue(before.getStartTime().before(before.getPreviousFireTime()));
        var faulted=spy(actual);doThrow(new SchedulerException("Owned replacement failure")).when(faulted).scheduleJob(any(JobDetail.class),any(Trigger.class));
        var service=new SysJobServiceImpl();ReflectionTestUtils.setField(service,"scheduler",faulted);
        assertThrows(SchedulerException.class,()->service.updateSchedulerJob(job("DEFAULT","0","ryTask.ryParams('replacement')"),"SYSTEM"));
        var restored=actual.getTriggersOfJob(key).get(0);assertEquals(before.getNextFireTime(),restored.getNextFireTime());assertEquals(before.getPreviousFireTime(),restored.getPreviousFireTime());
    }
}
