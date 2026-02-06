import { Navbar } from './Navbar';
import { motion } from 'framer-motion';

export function Layout({ children }) {
    return (
        <div className="min-h-screen flex flex-col">
            <Navbar />
            <motion.main
                className="flex-grow"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
            >
                {children}
            </motion.main>
            <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground bg-secondary/20">
                <div className="container mx-auto">
                    <p>© {new Date().getFullYear()} ODC IT Solutions. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
}
