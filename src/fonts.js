// 한글 픽셀 폰트(Galmuri11)를 번들에 포함해 오프라인에서도 도트 글씨가 나오게 한다.
import regular from 'galmuri/dist/Galmuri11.woff2?url';
import bold from 'galmuri/dist/Galmuri11-Bold.woff2?url';

for (const [url, weight] of [
  [regular, '400'],
  [bold, '700'],
]) {
  const face = new FontFace('Galmuri11', `url(${url})`, { weight });
  document.fonts.add(face);
  face.load().catch(() => {});
}
