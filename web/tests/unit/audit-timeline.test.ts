// @vitest-environment jsdom
import {createElement} from 'react';
import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {AuditTimeline} from '../../ui/AuditTimeline';

describe('audit display projection',()=>{
  it('preserves exact strings and distinguishes null, empty and zero without interpreting markup',()=>{
    const html=renderToStaticMarkup(createElement(AuditTimeline,{events:[{key:'1',action:'<script>run()</script>',actor:'9007199254740993',occurredAt:'bad-date',comment:'<img src=x onerror=run()>',changes:[{label:'金额',before:'9007199254740993.0100',after:'0'},{label:'备注',before:null,after:''}]}]}));
    const root=document.createElement('div');root.innerHTML=html;
    expect(root.querySelector('script,img')).toBeNull();
    expect(root.textContent).toContain('<img src=x onerror=run()>');
    expect(root.textContent).toContain('9007199254740993.0100');
    expect(root.querySelectorAll('pre')[1]?.textContent).toBe('0');
    expect(root.textContent).toContain('（未设置）');expect(root.textContent).toContain('（空文本）');expect(root.textContent).toContain('时间不可用');
  });
  it('keeps authoritative event order and the original timestamp while displaying an explicit empty state',()=>{
    const root=document.createElement('div');root.innerHTML=renderToStaticMarkup(createElement(AuditTimeline,{events:[{key:'b',action:'第二条',actor:'账号 2',occurredAt:'2026-10-18T12:00:00+08:00'},{key:'a',action:'第一条',actor:'账号 1',occurredAt:'2026-10-17T12:00:00Z'}]}));
    expect([...root.querySelectorAll('strong')].map(node=>node.textContent)).toEqual(['第二条','第一条']);expect(root.querySelector('time')?.getAttribute('datetime')).toBe('2026-10-18T12:00:00+08:00');
    expect(renderToStaticMarkup(createElement(AuditTimeline,{events:[ ]}))).toContain('暂无处理记录');
  });
});
