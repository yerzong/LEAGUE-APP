import Image from 'next/image';
import Link from 'next/link';

import { brand } from '@/config/brand';

export function BrandMark({ href }: { href: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 rounded-sm focus-ring">
      <Image src={brand.logo.src} alt="" width={32} height={32} className="size-8" />
      <span className="font-display text-lg font-bold text-brand caps">{brand.name}</span>
    </Link>
  );
}
