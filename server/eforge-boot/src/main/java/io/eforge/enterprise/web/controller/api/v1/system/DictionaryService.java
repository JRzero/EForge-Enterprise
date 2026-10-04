package io.eforge.enterprise.web.controller.api.v1.system;

import java.time.LocalDate;
import java.util.*;
import java.util.function.Supplier;
import com.github.pagehelper.PageHelper;
import com.github.pagehelper.PageInfo;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import io.eforge.enterprise.common.core.domain.entity.*;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.common.utils.SecurityUtils;
import io.eforge.enterprise.system.mapper.*;
import io.eforge.enterprise.web.controller.api.v1.PageResponse;
import static io.eforge.enterprise.web.controller.api.v1.system.DictionaryContracts.*;

@Service
public class DictionaryService
{
    private final SysDictTypeMapper types;
    private final SysDictDataMapper entries;
    private final DictionaryMutationMapper writes;
    private final DepartmentMutationMapper mutex;
    private final DictionaryCache cache;
    private final TransactionTemplate transaction;
    public DictionaryService(SysDictTypeMapper types,SysDictDataMapper entries,DictionaryMutationMapper writes,
            DepartmentMutationMapper mutex,DictionaryCache cache,PlatformTransactionManager transactions)
    {this.types=types;this.entries=entries;this.writes=writes;this.mutex=mutex;this.cache=cache;transaction=new TransactionTemplate(transactions);}
    public PageResponse<DictionaryResponse> list(int page,int size,String name,String code,String status,LocalDate from,LocalDate to)
    {
        var filter=filter(name,code,status,from,to);
        try{PageHelper.startPage(page,size,"dict_id asc");var rows=types.selectDictTypeList(filter);return new PageResponse<>(rows.stream().map(DictionaryResponse::from).toList(),new PageInfo<>(rows).getTotal(),page,size);}finally{PageHelper.clearPage();}
    }
    public List<SysDictType> exportTypes(String name,String code,String status,LocalDate from,LocalDate to) {return types.selectDictTypeList(filter(name,code,status,from,to));}
    public DictionaryResponse get(String id) {return DictionaryResponse.from(requireType(identifier(id)));}
    public List<DictionaryTypeOption> options() {return types.selectDictTypeAll().stream().sorted(Comparator.comparing(SysDictType::getDictId)).map(row->new DictionaryTypeOption(row.getDictId().toString(),row.getDictName(),row.getDictType(),row.getStatus())).toList();}
    public DictionaryResponse create(DictionaryRequest request)
    {return locked(()->{var row=type(request);unique(row);row.setCreateBy(SecurityUtils.getUsername());writes.insertType(row);cache.invalidate(row.getDictType());return DictionaryResponse.from(requireType(row.getDictId()));});}
    public void update(String id,DictionaryRequest request)
    {locked(()->{var old=requireType(identifier(id));var row=type(request);row.setDictId(old.getDictId());unique(row);row.setUpdateBy(SecurityUtils.getUsername());entries.updateDictDataType(old.getDictType(),row.getDictType());types.updateDictType(row);cache.invalidate(old.getDictType());if(!old.getDictType().equals(row.getDictType()))cache.invalidate(row.getDictType());return null;});}
    public void delete(List<String> ids)
    {locked(()->{var rows=ids.stream().distinct().map(DictionaryService::identifier).map(this::requireType).toList();for(var row:rows)if(entries.countDictDataByType(row.getDictType())>0)throw conflict("DICTIONARY_HAS_ENTRIES");for(var row:rows){types.deleteDictTypeById(row.getDictId());cache.invalidate(row.getDictType());}return null;});}
    public PageResponse<DictionaryEntryResponse> listEntries(int page,int size,String dictionaryId,String label,String status)
    {
        var type=requireType(identifier(dictionaryId));var filter=entryFilter(type,label,status);
        try{PageHelper.startPage(page,size,"dict_sort asc, dict_code asc");var rows=entries.selectDictDataList(filter);return new PageResponse<>(rows.stream().map(row->DictionaryEntryResponse.from(row,type)).toList(),new PageInfo<>(rows).getTotal(),page,size);}finally{PageHelper.clearPage();}
    }
    public List<SysDictData> exportEntries(String dictionaryId,String label,String status) {return entries.selectDictDataList(entryFilter(requireType(identifier(dictionaryId)),label,status));}
    public DictionaryEntryResponse getEntry(String id) {var row=requireEntry(identifier(id));return DictionaryEntryResponse.from(row,requireCode(row.getDictType()));}
    public DictionaryEntryResponse createEntry(EntryRequest request)
    {return locked(()->{var type=requireType(identifier(request.dictionaryId()));var row=entry(request,type);row.setCreateBy(SecurityUtils.getUsername());writes.insertEntry(row);cache.invalidate(type.getDictType());return DictionaryEntryResponse.from(requireEntry(row.getDictCode()),type);});}
    public void updateEntry(String id,EntryRequest request)
    {locked(()->{var old=requireEntry(identifier(id));var type=requireType(identifier(request.dictionaryId()));var row=entry(request,type);row.setDictCode(old.getDictCode());row.setUpdateBy(SecurityUtils.getUsername());entries.updateDictData(row);cache.invalidate(old.getDictType());if(!old.getDictType().equals(type.getDictType()))cache.invalidate(type.getDictType());return null;});}
    public void deleteEntries(List<String> ids)
    {locked(()->{var rows=ids.stream().distinct().map(DictionaryService::identifier).map(this::requireEntry).toList();for(var row:rows){entries.deleteDictDataById(row.getDictCode());cache.invalidate(row.getDictType());}return null;});}
    public List<DictionaryValueOption> lookup(String code)
    {
        // Canonical reads use committed DB rows, not potentially stale legacy cache data.
        // Preserve the original behavior: type status does not suppress active entries.
        return locked(()->{var type=types.selectDictTypeByType(code);if(type==null)return List.of();var rows=entries.selectDictDataByType(type.getDictType());cache.put(type.getDictType(),rows);return rows.stream().map(row->new DictionaryValueOption(row.getDictValue(),row.getDictLabel(),tagStyle(row.getListClass()),row.getCssClass(),row.getDefault())).toList();});
    }
    public void refresh()
    {locked(()->{cache.clear();for(var type:types.selectDictTypeAll())cache.put(type.getDictType(),entries.selectDictDataByType(type.getDictType()));return null;});}
    private <T>T locked(Supplier<T> work)
    {try{return transaction.execute(status->{if(mutex.lockRoot()==null)throw conflict("DEPARTMENT_ROOT_MISSING");return work.get();});}catch(DuplicateKeyException failure){throw conflict("DICTIONARY_CODE_EXISTS");}}
    private void unique(SysDictType row) {var duplicate=types.checkDictTypeUnique(row.getDictType());if(duplicate!=null && !Objects.equals(duplicate.getDictId(),row.getDictId()))throw conflict("DICTIONARY_CODE_EXISTS");}
    private SysDictType requireType(Long id) {var row=types.selectDictTypeById(id);if(row==null)throw new ApiFailure(404,"DICTIONARY_NOT_FOUND","Dictionary does not exist.");return row;}
    private SysDictType requireCode(String code) {var row=types.selectDictTypeByType(code);if(row==null)throw new ApiFailure(409,"DICTIONARY_ORPHAN_ENTRY","Dictionary entry has no type.");return row;}
    private SysDictData requireEntry(Long id) {var row=entries.selectDictDataById(id);if(row==null)throw new ApiFailure(404,"DICTIONARY_ENTRY_NOT_FOUND","Dictionary entry does not exist.");return row;}
    private static Long identifier(String value) {try{long id=Long.parseLong(value);if(id<1)throw invalid();return id;}catch(NumberFormatException|NullPointerException failure){throw invalid();}}
    private static ApiFailure invalid() {return new ApiFailure(400,"VALIDATION_ERROR","Invalid dictionary request.");}
    private static ApiFailure conflict(String code) {return new ApiFailure(409,code,"Dictionary operation conflicts with existing data.");}
    private static String clean(String value) {return value==null?"":value;}
    private static SysDictType type(DictionaryRequest request) {var row=new SysDictType();row.setDictName(request.name());row.setDictType(request.code());row.setStatus(request.status());row.setRemark(clean(request.remark()));return row;}
    private static SysDictData entry(EntryRequest request,SysDictType type)
    {var row=new SysDictData();row.setDictType(type.getDictType());row.setDictLabel(request.label());row.setDictValue(request.value());row.setDictSort(request.sort());row.setListClass(request.style().name().toLowerCase(Locale.ROOT));row.setCssClass(clean(request.cssClass()));row.setIsDefault(request.defaultEntry()?"Y":"N");row.setStatus(request.status());row.setRemark(clean(request.remark()));return row;}
    private static SysDictType filter(String name,String code,String status,LocalDate from,LocalDate to)
    {if(from!=null && to!=null && from.isAfter(to))throw invalid();var row=new SysDictType();row.setDictName(name);row.setDictType(code);row.setStatus(status);if(from!=null)row.getParams().put("beginTime",from.toString());if(to!=null)row.getParams().put("endTime",to.toString());return row;}
    private static SysDictData entryFilter(SysDictType type,String label,String status) {var row=new SysDictData();row.setDictType(type.getDictType());row.setDictLabel(label);row.setStatus(status);return row;}
}
