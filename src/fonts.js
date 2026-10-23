// 도트 폰트를 번들에 포함해 오프라인에서도 도트 글씨가 나오게 한다.
//  - Galmuri11: 한국어·영어·일본어 (굵은 글씨 파일에는 일본어가 없어서, 보통 굵기를 굵게 그리는 대체 글꼴을 따로 둔다)
//  - Fusion Pixel 12px SC: 중국어 간체 (OFL)
import regular from 'galmuri/dist/Galmuri11.woff2?url';
import bold from 'galmuri/dist/Galmuri11-Bold.woff2?url';
import zh from '@fontsource/fusion-pixel-12px-proportional-sc/files/fusion-pixel-12px-proportional-sc-latin-400-normal.woff2?url';

for (const [family, url, descriptors] of [
  ['Galmuri11', regular, { weight: '400' }],
  ['Galmuri11', bold, { weight: '700' }],
  ['Galmuri11 Fallback', regular, { weight: '400 700' }],
  ['Fusion Pixel SC', zh, { weight: '400 700' }],
]) {
  const face = new FontFace(family, `url(${url})`, descriptors);
  document.fonts.add(face);
  face.load().catch(() => {});
}
