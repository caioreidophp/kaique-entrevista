interface LogoProps {
    alt?: string;
    className?: string;
}

export function Logo({
    alt = 'Kaique Transportes',
    className = 'h-14 w-auto object-contain',
}: LogoProps) {
    return (
        <>
            <img
                src="/logo/logokaique.png"
                alt={alt}
                className={`${className} mx-auto block origin-center scale-[1.3] dark:hidden`}
                loading="eager"
                decoding="async"
            />
            <img
                src="/logo/logomodoescuro.png"
                alt={alt}
                className={`${className} mx-auto hidden dark:block`}
                loading="eager"
                decoding="async"
            />
        </>
    );
}
