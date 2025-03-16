import Link from 'next/link';
import { useRouter } from 'next/router';

interface NavLinkProps {
    href: string;
    children: React.ReactNode;
}

export default function NavLink({ href, children }: NavLinkProps) {
    const router = useRouter();
    const isActive = router.pathname === href;

    return (
        <Link href={href} className={`text-sm font-medium transition-colors hover:text-gray-900 ${isActive ? 'text-gray-900' : 'text-gray-500'
            }`}>
            {children}
        </Link>
    );
} 