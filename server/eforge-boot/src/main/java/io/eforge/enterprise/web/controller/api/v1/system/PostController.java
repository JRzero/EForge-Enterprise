package io.eforge.enterprise.web.controller.api.v1.system;

import java.net.URI;
import java.util.List;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import com.github.pagehelper.PageHelper;
import com.github.pagehelper.PageInfo;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import org.springframework.http.ResponseEntity;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import io.eforge.enterprise.common.annotation.Log;
import io.eforge.enterprise.common.enums.BusinessType;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.common.utils.SecurityUtils;
import io.eforge.enterprise.common.utils.poi.CanonicalExcelUtil;
import io.eforge.enterprise.system.domain.SysPost;
import io.eforge.enterprise.system.service.ISysPostService;
import io.eforge.enterprise.web.controller.api.v1.PageResponse;


/** Canonical facade; existing RuoYi service and permission rules stay authoritative. */
@RestController
@RequestMapping("/api/v1/system/posts")
public class PostController
{
    private final ISysPostService posts;
    public PostController(ISysPostService posts) { this.posts = posts; }

    @GetMapping
    @PreAuthorize("@ss.hasPermi('system:post:list')")
    @Operation(operationId = "listPosts")
    public PageResponse<PostResponse> list(
            @RequestParam(defaultValue = "1") @Min(1) @Max(1000000) int page,
            @RequestParam(defaultValue = "10") @Min(1) @Max(100) int pageSize,
            @RequestParam(defaultValue = "") @Size(max = 64) String code,
            @RequestParam(defaultValue = "") @Size(max = 50) String name,
            @RequestParam(defaultValue = "") @Pattern(regexp = "[01]?") String status)
    {
        try
        {
            // Stable paging order, with no user-provided SQL ordering expressions.
            PageHelper.startPage(page, pageSize, "post_sort asc, post_id asc");
            List<SysPost> rows = posts.selectPostList(filter(code, name, status));
            long total = new PageInfo<>(rows).getTotal();
            return new PageResponse<>(rows.stream().map(PostResponse::from).toList(), total, page, pageSize);
        }
        finally { PageHelper.clearPage(); }
    }

    @GetMapping("/{id}")
    @PreAuthorize("@ss.hasPermi('system:post:query')")
    @Operation(operationId = "getPost")
    public PostResponse get(@PathVariable @Pattern(regexp = "[1-9][0-9]{0,18}") String id)
    { return PostResponse.from(require(identifier(id))); }

    @PostMapping
    @PreAuthorize("@ss.hasPermi('system:post:add')")
    @Log(title = "岗位管理", businessType = BusinessType.INSERT)
    @Operation(operationId = "createPost")
    @ApiResponse(responseCode = "201", description = "Created post", content = @Content(schema = @Schema(implementation = PostResponse.class)))
    public ResponseEntity<PostResponse> create(@Valid @RequestBody PostRequest request)
    {
        SysPost post = entity(request);
        unique(post);
        post.setCreateBy(SecurityUtils.getUsername());
        try { posts.insertPost(post); }
        catch (DuplicateKeyException exception)
        {
            unique(post);
            throw failure(409, "POST_CONFLICT", "Post code or name already exists.");
        }
        return ResponseEntity.created(URI.create("/api/v1/system/posts/" + post.getPostId()))
                .body(PostResponse.from(require(post.getPostId())));
    }

    @PutMapping("/{id}")
    @PreAuthorize("@ss.hasPermi('system:post:edit')")
    @Log(title = "岗位管理", businessType = BusinessType.UPDATE)
    @Operation(operationId = "updatePost")
    public PostResponse update(@PathVariable @Pattern(regexp = "[1-9][0-9]{0,18}") String id,
            @Valid @RequestBody PostRequest request)
    {
        Long postId = identifier(id);
        require(postId);
        SysPost post = entity(request);
        post.setPostId(postId);
        unique(post);
        post.setUpdateBy(SecurityUtils.getUsername());
        try
        {
            if (posts.updatePost(post) != 1) throw failure(404, "POST_NOT_FOUND", "Post does not exist.");
        }
        catch (DuplicateKeyException exception)
        {
            unique(post);
            throw failure(409, "POST_CONFLICT", "Post code or name already exists.");
        }
        return PostResponse.from(require(postId));
    }

    @DeleteMapping
    @PreAuthorize("@ss.hasPermi('system:post:remove')")
    @Log(title = "岗位管理", businessType = BusinessType.DELETE)
    @Operation(operationId = "deletePosts")
    @ApiResponse(responseCode = "204", description = "Posts deleted", content = @Content)
    public ResponseEntity<Void> delete(@Valid @RequestBody DeletePostsRequest request)
    {
        Long[] ids = request.ids().stream().map(PostController::identifier).distinct().toArray(Long[]::new);
        for (Long id : ids)
        {
            require(id);
            if (posts.countUserPostById(id) > 0) throw failure(409, "POST_IN_USE", "Post is assigned to users and cannot be deleted.");
        }
        posts.deletePostByIds(ids);
        return ResponseEntity.noContent().build();
    }

    @PostMapping(value = "/export", produces = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    @PreAuthorize("@ss.hasPermi('system:post:export')")
    @Log(title = "岗位管理", businessType = BusinessType.EXPORT)
    @Operation(operationId = "exportPosts")
    @ApiResponse(responseCode = "200", description = "Filtered XLSX workbook", content = @Content(
            mediaType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            schema = @Schema(type = "string", format = "binary")))
    public void export(HttpServletResponse response,
            @RequestParam(defaultValue = "") @Size(max = 64) String code,
            @RequestParam(defaultValue = "") @Size(max = 50) String name,
            @RequestParam(defaultValue = "") @Pattern(regexp = "[01]?") String status)
    {
        new CanonicalExcelUtil<>(SysPost.class).exportExcel(response, posts.selectPostList(filter(code, name, status)), "岗位数据");
    }

    private static ApiFailure failure(int status, String code, String detail) { return new ApiFailure(status, code, detail); }
    private static Long identifier(String value)
    {
        try { return Long.valueOf(value); }
        catch (NumberFormatException exception) { throw failure(400, "VALIDATION_ERROR", "The identifier is invalid."); }
    }
    private SysPost require(Long id)
    {
        SysPost post = posts.selectPostById(id);
        if (post == null) throw failure(404, "POST_NOT_FOUND", "Post does not exist.");
        return post;
    }
    private void unique(SysPost post)
    {
        if (!posts.checkPostCodeUnique(post)) throw failure(409, "POST_CODE_EXISTS", "Post code already exists.");
        if (!posts.checkPostNameUnique(post)) throw failure(409, "POST_NAME_EXISTS", "Post name already exists.");
    }
    private static SysPost filter(String code, String name, String status)
    {
        SysPost post = new SysPost();
        post.setPostCode(code); post.setPostName(name); post.setStatus(status);
        return post;
    }
    private static SysPost entity(PostRequest request)
    {
        SysPost post = filter(request.code(), request.name(), request.status());
        post.setPostSort(request.sort());
        post.setRemark(request.remark() == null ? "" : request.remark());
        return post;
    }
}
