import { marked, Renderer } from 'marked';

const renderer = new Renderer();
renderer.image = () => '';              // no images
marked.use({ renderer, gfm: true, breaks: true });

export function renderMarkdown(raw: string): string {
  return marked.parse(raw) as string;
}
