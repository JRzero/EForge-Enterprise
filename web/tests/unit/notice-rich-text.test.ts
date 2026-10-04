// @vitest-environment jsdom
import {describe, expect, it} from 'vitest';
import {sanitizeNoticeHtml} from '../../features/notices/rich-text';

function content(html: string) {
  const container = document.createElement('div'); container.innerHTML = sanitizeNoticeHtml(html); return container;
}

describe('notice rich text boundary', () => {
  it('preserves headings, lists, indentation, colors, typography and links', () => {
    const result = content('<h2>公告</h2><ol><li data-list="bullet" class="ql-indent-2 ql-align-center app-overlay"><strong>重点</strong></li></ol><p><span class="ql-size-large" style="color:red;background-color:#ffee00;font-size:18px;font-family:宋体;text-align:right;position:fixed;inset:0">内容</span><a href="https://example.com" target="_blank">详情</a></p><blockquote>引用</blockquote><pre class="ql-syntax">code</pre>');
    expect(result.querySelector('h2')?.textContent).toBe('公告');
    expect(result.querySelector('li')?.className).toBe('ql-indent-2 ql-align-center');
    expect(result.querySelector('li')?.getAttribute('data-list')).toBe('bullet');
    expect(result.querySelector('span')?.style.color).toBe('red');
    expect(result.querySelector('span')?.style.fontFamily).toBe('宋体');
    expect(result.querySelector('span')?.style.position).toBe('');
    expect(result.querySelector('a')?.rel).toBe('noopener noreferrer');
    expect(result.querySelector('blockquote')?.textContent).toBe('引用');
    expect(result.querySelector('pre')?.className).toBe('ql-syntax');
  });
  it('removes executable elements, events, DOM clobbering and dangerous URLs', () => {
    const result = content('<script>alert(1)</script><svg onload="alert(1)"></svg><form id="location"><input name="href"></form><img src="x" onerror="alert(1)"><a href="java&#x09;script:alert(1)" onclick="alert(1)">bad</a><a href="data:text/html,evil">bad2</a><iframe src="javascript:alert(1)" srcdoc="<script>alert(1)</script>" sandbox="allow-same-origin"></iframe>');
    expect(result.querySelector('script,svg,form,input,[id],[name],[onerror],[onclick],[srcdoc]')).toBeNull();
    expect([...result.querySelectorAll('a')].every(link => !link.hasAttribute('href'))).toBe(true);
    expect(result.querySelector('iframe')?.hasAttribute('src')).toBe(false);
    expect(result.querySelector('iframe')?.getAttribute('sandbox')).toBe('allow-scripts allow-presentation');
  });
  it('preserves raster images and sandboxed video but rejects executable data images', () => {
    const result = content('<img src="/profile/upload/image.svg"><img src="data:image/png;base64,YQ=="><img src="data:image/svg+xml;base64,YQ=="><iframe class="ql-video" src="https://www.youtube.com/embed/test" allow="camera; microphone"></iframe>');
    const images = result.querySelectorAll('img');
    expect(images[0]?.getAttribute('src')).toBe('/profile/upload/image.svg');
    expect(images[1]?.getAttribute('src')).toBe('data:image/png;base64,YQ==');
    expect(images[2]?.hasAttribute('src')).toBe(false);
    const video = result.querySelector('iframe');
    expect(video?.getAttribute('src')).toBe('https://www.youtube.com/embed/test');
    expect(video?.getAttribute('sandbox')).not.toContain('allow-same-origin');
    expect(video?.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(video?.hasAttribute('allow')).toBe(false);
  });
  it.each([
    '<math><mtext><table><mglyph><style><!--</style><img title="--><img src=x onerror=alert(1)>">',
    '<iframe><img src=x onerror=alert(1)></iframe>',
    '<p style="color:var(--evil);background-image:url(javascript:alert(1));font-size:99999px;position:fixed">text</p>',
    '<a href="vbscript:evil">x</a><img src="data:text/html,evil"><div class="ql-indent-99 hidden">x</div>',
  ])('survives hostile HTML reparsing: %s', html => {
    const clean = sanitizeNoticeHtml(html), result = content(clean);
    expect(result.querySelector('script,svg,math,style,[onerror],[onclick]')).toBeNull();
    expect(result.innerHTML).not.toMatch(/(?:javascript:|vbscript:|position:\s*fixed|font-size:\s*99999|var\(--evil)/i);
    expect(sanitizeNoticeHtml(clean)).toBe(clean);
  });
});
