// @vitest-environment jsdom
import {describe,it,expect} from 'vitest';
import {prepareDiagram,BPMN} from '../../features/workflow/designer-xml';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const xml=readFileSync(resolve(process.cwd(),'../workflows/leave-approval/process.bpmn20.xml'),'utf8');
describe('workflow diagram import',()=>{
  it('adds DI to old XML without changing semantic nodes and preserves existing layout',()=>{
    const output=prepareDiagram(xml),doc=new DOMParser().parseFromString(output,'application/xml');
    expect(doc.getElementsByTagNameNS(BPMN,'userTask')[0]?.getAttributeNS('http://flowable.org/bpmn','candidateGroups')).toBe('role:2');
    expect(doc.getElementsByTagNameNS('http://www.omg.org/spec/BPMN/20100524/DI','BPMNShape').length).toBeGreaterThan(3);
    expect(prepareDiagram(output)).toBe(output);
  });
  it('rejects malformed XML, external entities and unsupported nodes before modeler import',()=>{
    for(const value of ['<broken>','<!DOCTYPE definitions>'+xml,xml.replace('<userTask','<scriptTask').replace('</userTask>','</scriptTask>')])expect(()=>prepareDiagram(value)).toThrow();
  });
});

