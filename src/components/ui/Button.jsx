import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';

const variants = {
    primary: 'bg-primary text-primary-foreground hover:brightness-110 active:scale-95 shadow-lg shadow-primary/20',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 active:scale-95',
    outline: 'border-2 border-primary text-primary hover:bg-primary/10 active:scale-95',
    ghost: 'text-foreground hover:bg-secondary/50 active:scale-95',
};

const sizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
};

export function Button({
    className,
    variant = 'primary',
    size = 'md',
    children,
    ...props
}) {
    return (
        <motion.button
            className={cn(
                'rounded-md font-bold transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
                variants[variant],
                sizes[size],
                className
            )}
            whileTap={{ scale: 0.95 }}
            {...props}
        >
            {children}
        </motion.button>
    );
}
