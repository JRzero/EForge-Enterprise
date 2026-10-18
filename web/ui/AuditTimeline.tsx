import './audit-timeline.css';

export type AuditChange={label:string;before:string|null;after:string|null};
export type AuditEvent={key:string;action:string;actor:string;occurredAt:string;comment?:string;changes?:readonly AuditChange[]};

/** Display-only projection. Callers choose authorized fields; never pass raw audit payloads. */
export function AuditTimeline({events,label='处理记录'}:{events:readonly AuditEvent[];label?:string}){
  return <section className="ui-audit-timeline" aria-label={label}><h2>{label}</h2>
    {events.length===0?<p role="status">暂无处理记录</p>:<ol>{events.map(event=>{
      const date=new Date(event.occurredAt),valid=Number.isFinite(date.getTime());
      return <li key={event.key}><strong>{event.action}</strong><div className="ui-audit-meta"><span>{event.actor}</span>
        {valid?<time dateTime={event.occurredAt} title={event.occurredAt}>{date.toLocaleString('zh-CN')}</time>:<span>时间不可用</span>}</div>
        {event.comment&&<p className="ui-audit-comment">{event.comment}</p>}
        {!!event.changes?.length&&<dl>{event.changes.map((change,index)=><div className="ui-audit-change" key={index}><dt>{change.label}</dt><dd><span>修改前</span><pre>{change.before===null?'（未设置）':change.before===''?'（空文本）':change.before}</pre><span>修改后</span><pre>{change.after===null?'（未设置）':change.after===''?'（空文本）':change.after}</pre></dd></div>)}</dl>}
      </li>;
    })}</ol>}
  </section>;
}
