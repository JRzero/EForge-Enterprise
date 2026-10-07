/** Image sources remain data: no HTML, data schemes, embedded credentials or script URLs. */
export function safeResourceUrls(source: string, origin: string): string[] {
  return source.split(',').flatMap(raw => {
    const value=raw.trim();
    if (!value || Array.from(value).some(character=>character.charCodeAt(0)<32 || character.charCodeAt(0)===127)) return [];
    try {
      const url=new URL(value,origin+'/');
      return ['http:','https:'].includes(url.protocol) && !url.username && !url.password ? [url.href] : [];
    } catch {return [];}
  });
}

