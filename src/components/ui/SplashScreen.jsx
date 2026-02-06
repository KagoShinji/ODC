import { motion } from 'framer-motion';

export function SplashScreen({ finishLoading }) {
    return (
        <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-background"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            onAnimationComplete={() => finishLoading()}
        >
            <div className="relative flex flex-col items-center">
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="text-6xl md:text-8xl font-display font-bold tracking-tighter text-foreground"
                >
                    ODC
                </motion.div>
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    transition={{ delay: 0.5, duration: 0.8, ease: "easeInOut" }}
                    className="h-1 bg-primary mt-4 rounded-full"
                />
            </div>
        </motion.div>
    );
}
