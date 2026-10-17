import Link from 'next/link';
import { Mascot } from '@/components/Mascot';

export default function NotFound() {
  return <main className="min-h-screen bg-bg-soft flex flex-col items-center justify-center px-6 py-12 text-center">
    <Mascot size={128} mood="think" animate={false} />
    <h1 className="text-2xl font-extrabold text-ink mt-6">这页走丢了</h1>
    <p className="text-sm text-ink-light leading-relaxed mt-3 max-w-xs">链接可能已更新。回到学习页面，继续刚才的学习吧。</p>
    <Link href="/" className="btn-chunky-primary mt-7">返回学习页面</Link>
  </main>;
}
