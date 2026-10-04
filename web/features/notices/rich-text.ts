import createDOMPurify from 'dompurify';

const tags = ['p', 'br', 'div', 'span', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'blockquote', 'pre', 'code', 'ol', 'ul', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'img', 'iframe', 'sub', 'sup'];
const classes = /^(?:ql-align-(?:center|right|justify)|ql-indent-[1-8]|ql-size-(?:small|large|huge)|ql-direction-rtl|ql-code-block(?:-container)?|ql-syntax|ql-ui|ql-video)$/;

function safeUrl(value: string, kind: 'link' | 'image' | 'video'): boolean {
  if ([...value].some(character => character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127)) return false;
  if (kind === 'image' && /^data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/]+=*$/i.test(value)) return true;
  try {
    const url = new URL(value, 'https://notice.invalid/');
    return ['http:', 'https:', ...(kind === 'link' ? ['mailto:', 'tel:'] : [])].includes(url.protocol);
  } catch {return false;}
}

function safeStyle(element: Element, value: string): string {
  const style = element.ownerDocument.createElement('span').style;
  style.cssText = value;
  const result: string[] = [];
  for (const property of ['color', 'background-color', 'font-size', 'font-family', 'text-align']) {
    const declaration = style.getPropertyValue(property);
    if (!declaration || /(?:url|expression|var|attr)\s*\(|[\\<>]/i.test(declaration)) continue;
    if (property === 'font-size' && !/^(?:[1-9]\d?(?:\.\d+)?(?:px|pt)|(?:small|medium|large|x-large|xx-large))$/.test(declaration)) continue;
    if (property === 'font-family' && !/^[\p{L}\p{N}\s,'"-]+$/u.test(declaration)) continue;
    if (property === 'text-align' && !/^(?:left|right|center|justify)$/.test(declaration)) continue;
    result.push(`${property}: ${declaration}`);
  }
  return result.join('; ');
}

/** One HTML boundary for server content, pasted content and editor exports. */
export function sanitizeNoticeHtml(html: string): string {
  const purifier = createDOMPurify(window);
  purifier.addHook('uponSanitizeAttribute', (node, attribute) => {
    const tag = node.nodeName.toLowerCase();
    if (attribute.attrName === 'style') attribute.attrValue = safeStyle(node as Element, attribute.attrValue);
    if (attribute.attrName === 'class') attribute.attrValue = attribute.attrValue.split(/\s+/).filter(value => classes.test(value)).join(' ');
    if (attribute.attrName === 'href') attribute.keepAttr = tag === 'a' && safeUrl(attribute.attrValue, 'link');
    if (attribute.attrName === 'src') attribute.keepAttr = (tag === 'img' || tag === 'iframe') && safeUrl(attribute.attrValue, tag === 'img' ? 'image' : 'video');
    if (attribute.attrName === 'target') attribute.keepAttr = tag === 'a' && attribute.attrValue === '_blank';
    if (attribute.attrName === 'data-list') attribute.keepAttr = tag === 'li' && /^(?:ordered|bullet)$/.test(attribute.attrValue);
  });
  purifier.addHook('afterSanitizeAttributes', node => {
    if (node.nodeName === 'A') node.setAttribute('rel', 'noopener noreferrer');
    if (node.nodeName === 'IFRAME') {
      // Scripts may run inside a video player, but never with our origin privileges.
      node.setAttribute('sandbox', 'allow-scripts allow-presentation');
      node.setAttribute('referrerpolicy', 'no-referrer');
      node.setAttribute('allowfullscreen', '');
      node.setAttribute('title', '公告视频');
    }
  });
  return purifier.sanitize(html, {
    ALLOWED_TAGS: tags,
    ALLOWED_ATTR: ['class', 'style', 'href', 'target', 'src', 'alt', 'title', 'data-list'],
    ALLOW_DATA_ATTR: false, ALLOW_ARIA_ATTR: false,
    // Keep DOMPurify's raw-text/mutation-XSS checks enabled, including for iframes.
    SAFE_FOR_XML: true,
  });
}
