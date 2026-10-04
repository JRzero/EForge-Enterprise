package io.eforge.enterprise.system.mapper;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Update;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.ConstructorArgs;
import org.apache.ibatis.annotations.Arg;
import java.util.List;
import java.util.Date;
import io.eforge.enterprise.system.domain.SysNotice;

/** Canonical writes preserve rich text and explicitly clear optional fields. */
public interface NoticeMutationMapper
{
    @Insert("INSERT INTO sys_notice(notice_title,notice_type,notice_content,status,remark,create_by,create_time) VALUES(#{noticeTitle},#{noticeType},#{noticeContent},#{status},#{remark},#{createBy},sysdate())")
    @Options(useGeneratedKeys = true, keyProperty = "noticeId")
    int insert(SysNotice row);

    @Update("UPDATE sys_notice SET notice_title=#{noticeTitle},notice_type=#{noticeType},notice_content=#{noticeContent},status=#{status},remark=#{remark},update_by=#{updateBy},update_time=sysdate() WHERE notice_id=#{noticeId}")
    int update(SysNotice row);

    record ReaderRow(Long userId,String username,String displayName,String departmentName,String phone,Date readTime) {}

    @Select("<script>SELECT u.user_id AS userId,u.user_name AS username,u.nick_name AS displayName,d.dept_name AS departmentName,u.phonenumber AS phone,r.read_time AS readTime FROM sys_notice_read r INNER JOIN sys_user u ON u.user_id=r.user_id AND u.del_flag='0' LEFT JOIN sys_dept d ON d.dept_id=u.dept_id WHERE r.notice_id=#{noticeId} <if test=\"search != null and search != ''\">AND (u.user_name LIKE concat('%',#{search},'%') OR u.nick_name LIKE concat('%',#{search},'%'))</if> ORDER BY r.read_time DESC,r.read_id DESC</script>")
    @ConstructorArgs({@Arg(column="userId",javaType=Long.class),@Arg(column="username",javaType=String.class),
        @Arg(column="displayName",javaType=String.class),@Arg(column="departmentName",javaType=String.class),
        @Arg(column="phone",javaType=String.class),@Arg(column="readTime",javaType=Date.class)})
    List<ReaderRow> selectReaders(@Param("noticeId") Long noticeId,@Param("search") String search);
}
