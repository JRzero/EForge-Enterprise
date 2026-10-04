package io.eforge.enterprise.web.controller.api.v1.system;

import java.util.List;
import org.springframework.stereotype.Component;
import io.eforge.enterprise.common.core.domain.entity.SysDictData;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.common.utils.DictUtils;

/** Existing Redis namespace, with failures surfaced rather than silently ignored. */
@Component
public class DictionaryCache
{
    public void invalidate(String code) {run(()->DictUtils.removeDictCache(code));}
    public void put(String code,List<SysDictData> rows) {run(()->DictUtils.setDictCache(code,rows));}
    public void clear() {run(DictUtils::clearDictCache);}
    private void run(Runnable work) {try{work.run();}catch(RuntimeException failure){throw new ApiFailure(503,"DICTIONARY_CACHE_UNAVAILABLE","Dictionary cache is temporarily unavailable.");}}
}
