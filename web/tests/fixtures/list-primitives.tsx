import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {EForgeProvider} from '../../ui/controls';
import {TreeListLayout} from '../../ui/TreeListLayout';
import {PaginationNavigation} from '../../ui/PaginationNavigation';
import '../../ui/theme.css';

function Fixture() {
  const [page,setPage]=useState(1);
  return <main style={{padding:16}}><TreeListLayout sidebarLabel="部门树" sidebar={<ul><li><button type="button" aria-pressed="true">研发部门</button></li></ul>}>
    <p>独立列表内容</p>
    <PaginationNavigation page={page} pageSize={10} total={10000} disabled={false} onChange={setPage}/>
    <output aria-label="当前页">{page}</output>
  </TreeListLayout></main>;
}
createRoot(document.getElementById('root')!).render(<EForgeProvider><Fixture/></EForgeProvider>);
