package io.eforge.enterprise.workflow;

import java.util.HashSet;
import javax.sql.DataSource;
import org.flowable.bpmn.model.UserTask;
import org.springframework.jdbc.core.JdbcTemplate;
import io.eforge.enterprise.common.exception.ApiFailure;

/** Current SQL identities, shared by synchronous and deferred task creation. */
final class WorkflowTaskCandidates {
    private final JdbcTemplate jdbc;
    WorkflowTaskCandidates(DataSource source){jdbc=new JdbcTemplate(source);}
    void requireAvailable(UserTask binding){
        requireAvailable(binding,false);
    }
    void requireCurrent(UserTask binding){requireAvailable(binding,true);}
    private void requireAvailable(UserTask binding,boolean current){
        var users=new HashSet<>(binding.getCandidateUsers());
        if(binding.getAssignee()!=null&&!binding.getAssignee().isBlank())users.add(binding.getAssignee());
        String suffix=current?" limit 1 for update":" limit 1";
        boolean available=users.stream().anyMatch(user->!jdbc.queryForList("select user_id from sys_user where user_id=? and status='0' and del_flag='0'"+suffix,String.class,user).isEmpty());
        if(!available)for(var group:binding.getCandidateGroups())if(group.startsWith("role:")&&!jdbc.queryForList("select u.user_id from sys_user u join sys_user_role ur on ur.user_id=u.user_id join sys_role r on r.role_id=ur.role_id where r.role_id=? and r.status='0' and r.del_flag='0' and u.status='0' and u.del_flag='0'"+suffix,String.class,group.substring(5)).isEmpty()){available=true;break;}
        if(!available)throw new ApiFailure(409,"WORKFLOW_CANDIDATE_UNAVAILABLE","当前审批任务没有有效审批人。");
    }
}
