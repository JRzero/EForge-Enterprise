package io.eforge.enterprise.web.controller.api.v1.monitor;

import org.junit.jupiter.api.*;
import org.springframework.context.support.GenericApplicationContext;
import org.springframework.test.util.ReflectionTestUtils;
import io.eforge.enterprise.common.utils.spring.SpringUtils;
import io.eforge.enterprise.quartz.task.RyTask;
import io.eforge.enterprise.quartz.util.TaskInvocationPolicy;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class TaskInvocationPolicyTest {
    GenericApplicationContext context;Object previousFactory,previousContext;RyTask task;
    @BeforeEach void setup(){
        previousFactory=ReflectionTestUtils.getField(SpringUtils.class,"beanFactory");previousContext=ReflectionTestUtils.getField(SpringUtils.class,"applicationContext");
        context=new GenericApplicationContext();task=spy(new RyTask());context.getBeanFactory().registerSingleton("ryTask",task);context.refresh();
        var bridge=new SpringUtils();bridge.postProcessBeanFactory(context.getBeanFactory());bridge.setApplicationContext(context);
    }
    @AfterEach void cleanup(){context.close();ReflectionTestUtils.setField(SpringUtils.class,"beanFactory",previousFactory);ReflectionTestUtils.setField(SpringUtils.class,"applicationContext",previousContext);}
    @Test void fiveOriginalWrapperTypesPreserveExactUnicodePunctuationAndLargeNumbers() {
        var target=TaskInvocationPolicy.parse("ryTask.ryMultipleParams('中文,(parentheses),O'Brian,\"double\"',TRUE,9007199254740993L,0x1.0p2D,-2147483648)");
        assertArrayEquals(new Class<?>[]{String.class,Boolean.class,Long.class,Double.class,Integer.class},target.parameterTypes());
        assertArrayEquals(new Object[]{"中文,(parentheses),O'Brian,\"double\"",true,9007199254740993L,4.0D,Integer.MIN_VALUE},target.parameterValues());
        assertTrue(Double.isNaN((Double)TaskInvocationPolicy.parse("ryTask.ryMultipleParams('',false,-9223372036854775808L,NaND,0)").parameterValues()[3]));
    }
    @Test void actualInvocationPassesExpressionLookingStringDataWithoutEvaluation() throws Exception {
        String literal="中文,(T(java.lang.Runtime)),O'Brian,\"double\",${inert}";
        var source="ryTask.ryParams('"+literal+"')";TaskInvocationPolicy.validate(source);verifyNoInteractions(task);
        TaskInvocationPolicy.invoke(source);verify(task).ryParams(literal);
    }
    @Test void exactPackageBoundaryRejectsSiblingWithoutClassInitializationAndObjectMethods() {
        String key="eforge.owned.invocation.prefix.initialized",before=System.getProperty(key);
        assertFalse(TaskInvocationPolicy.isAllowed("io.eforge.enterprise.quartz.taskevil.InvocationPrefixProbe.execute()"));assertEquals(before,System.getProperty(key));
        for(String source:new String[]{"ryTask.getClass()","ryTask.wait()","java.lang.Runtime.getRuntime()","unknownBean.execute()"})
            assertThrows(IllegalArgumentException.class,()->TaskInvocationPolicy.validate(source));verifyNoInteractions(task);
    }
    @Test void classAndBeanFormsRemainAllowedButMissingMethodOnlyRetainsLegacyFailureBehavior() throws Exception {
        assertDoesNotThrow(()->TaskInvocationPolicy.validate("io.eforge.enterprise.quartz.task.RyTask.ryNoParams()"));
        assertTrue(TaskInvocationPolicy.isAllowed("ryTask.missingMethod()"));assertThrows(IllegalArgumentException.class,()->TaskInvocationPolicy.validate("ryTask.missingMethod()"));
        assertThrows(NoSuchMethodException.class,()->TaskInvocationPolicy.invoke("ryTask.missingMethod()"));verifyNoInteractions(task);
    }
    @Test void malformedOrExecutableParameterFormsAreRejectedWithoutInvoking() {
        for(String source:new String[]{"ryTask.ryParams('unterminated)","ryTask.ryNoParams();evil()","ryTask.ryParams(new String('payload'))",
            "ryTask.ryParams(null)","ryTask.ryParams(${expression})","ryTask.ryParams(9223372036854775808L)","ryTask.ryNoParams(,)","ryTask.ryParams('x').other()"})
            assertThrows(IllegalArgumentException.class,()->TaskInvocationPolicy.parse(source));verifyNoInteractions(task);
    }
    @Test void validationUsesLazyBeanMetadataWithoutConstructingAllowedOrDisallowedTargets() throws Exception {
        var allowedCount=new java.util.concurrent.atomic.AtomicInteger();var deniedCount=new java.util.concurrent.atomic.AtomicInteger();
        var allowed=new org.springframework.beans.factory.support.RootBeanDefinition(RyTask.class);allowed.setLazyInit(true);allowed.setInstanceSupplier(()->{allowedCount.incrementAndGet();return new RyTask();});
        var denied=new org.springframework.beans.factory.support.RootBeanDefinition(java.util.Date.class);denied.setLazyInit(true);denied.setInstanceSupplier(()->{deniedCount.incrementAndGet();return new java.util.Date();});
        context.registerBeanDefinition("lazyTask",allowed);context.registerBeanDefinition("unsafeTask",denied);
        TaskInvocationPolicy.validate("lazyTask.ryNoParams()");assertThrows(IllegalArgumentException.class,()->TaskInvocationPolicy.validate("unsafeTask.toInstant()"));
        assertEquals(0,allowedCount.get());assertEquals(0,deniedCount.get());
        TaskInvocationPolicy.invoke("lazyTask.ryNoParams()");assertEquals(1,allowedCount.get());assertEquals(0,deniedCount.get());
    }
    @Test void originalSeededNoArgumentTargetWithoutParenthesesRemainsValidAndRunnable() throws Exception {
        TaskInvocationPolicy.validate("ryTask.ryNoParams");assertTrue(TaskInvocationPolicy.isAllowed("ryTask.ryNoParams"));
        TaskInvocationPolicy.invoke("ryTask.ryNoParams");verify(task).ryNoParams();
    }
    @Test void registeredTaskBeanAliasesRemainExactRegistryDataRatherThanJavaExpressions() throws Exception {
        context.registerAlias("ryTask","daily-task:执行");String source="daily-task:执行.ryParams('literal,内容')";
        TaskInvocationPolicy.validate(source);assertTrue(TaskInvocationPolicy.isAllowed(source));verifyNoInteractions(task);
        TaskInvocationPolicy.invoke(source);verify(task).ryParams("literal,内容");
        assertThrows(IllegalArgumentException.class,()->TaskInvocationPolicy.validate("unregistered-task.ryNoParams()"));
    }
}
