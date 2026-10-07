package io.eforge.enterprise.quartz.service;

import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import java.util.Set;

/** Runs outside the compatibility service's transaction advisor. */
@Aspect @Component @Order(Ordered.HIGHEST_PRECEDENCE+20)
public class TaskMutationAspect {
    private static final Set<String> MUTATIONS=Set.of("pauseJob","resumeJob","deleteJob","deleteJobByIds",
            "changeStatus","run","insertJob","updateJob","updateSchedulerJob");
    private final TaskMutationBoundary boundary;
    public TaskMutationAspect(TaskMutationBoundary boundary){this.boundary=boundary;}
    @Around("execution(public * io.eforge.enterprise.quartz.service.impl.SysJobServiceImpl.*(..))")
    public Object mutate(ProceedingJoinPoint call) throws Throwable {
        if(!MUTATIONS.contains(call.getSignature().getName()))return call.proceed();
        return boundary.mutate(call.getArgs(),call::proceed);
    }
}
