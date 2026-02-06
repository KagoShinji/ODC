import { motion } from 'framer-motion';
import { Button } from '../ui/Button';
import { Mail, Phone, MapPin, Send, Facebook, Linkedin, Instagram } from 'lucide-react';

export function ContactSection() {
    return (
        <section id="contact" className="pt-24 md:pt-32 pb-20 bg-background relative overflow-hidden">
            <div className="container mx-auto px-6 md:px-12 relative z-10">
                <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-start">

                    {/* Info Side */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                    >
                        <span className="text-sm font-semibold text-primary uppercase tracking-wider mb-2 block">Get in Touch</span>
                        <h2 className="text-3xl md:text-4xl font-bold mb-6 tracking-tight">Let's Start a Conversation</h2>
                        <p className="text-muted-foreground mb-12 text-lg font-light leading-relaxed">
                            Have a project in mind? We'd love to hear from you. Send us a message and we'll get back to you shortly.
                        </p>

                        <div className="space-y-8">
                            <div className="flex items-start gap-6 group">
                                <div className="p-3 bg-secondary/30 rounded-full text-foreground group-hover:text-primary transition-colors"><Mail className="w-5 h-5" /></div>
                                <div>
                                    <h3 className="font-bold mb-1">Email Us</h3>
                                    <p className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer">odysseyclinsys1@gmail.com</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-6 group">
                                <div className="p-3 bg-secondary/30 rounded-full text-foreground group-hover:text-primary transition-colors"><Phone className="w-5 h-5" /></div>
                                <div>
                                    <h3 className="font-bold mb-1">Call Us</h3>
                                    <p className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer">0993-005-0994</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-6 group">
                                <div className="p-3 bg-secondary/30 rounded-full text-foreground group-hover:text-primary transition-colors"><MapPin className="w-5 h-5" /></div>
                                <div>
                                    <h3 className="font-bold mb-1">Visit Us</h3>
                                    <p className="text-muted-foreground">3409 Pearl Corner Jade St. Casals Village, Mabolo, Cebu City</p>
                                </div>
                            </div>
                        </div>

                        <div className="pt-12 mt-12 border-t border-border/50">
                            <h3 className="font-bold mb-6">Follow Us</h3>
                            <div className="flex gap-4">
                                <Button size="icon" variant="ghost" className="rounded-full hover:bg-secondary/50" onClick={() => window.open('https://facebook.com/profile.php?id=61587269647950', '_blank')}>
                                    <Facebook className="w-5 h-5" />
                                </Button>
                                <Button size="icon" variant="ghost" className="rounded-full hover:bg-secondary/50" onClick={() => window.open('https://linkedin.com', '_blank')}>
                                    <Linkedin className="w-5 h-5" />
                                </Button>
                                <Button size="icon" variant="ghost" className="rounded-full hover:bg-secondary/50" onClick={() => window.open('https://instagram.com', '_blank')}>
                                    <Instagram className="w-5 h-5" />
                                </Button>
                            </div>
                        </div>
                    </motion.div>

                    {/* Form Side */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        className="bg-secondary/10 p-8 md:p-12 rounded-3xl"
                    >
                        <form className="space-y-6">
                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">First Name</label>
                                    <input className="w-full px-0 py-3 bg-transparent border-b border-border focus:border-primary focus:outline-none transition-colors" placeholder="John" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Last Name</label>
                                    <input className="w-full px-0 py-3 bg-transparent border-b border-border focus:border-primary focus:outline-none transition-colors" placeholder="Doe" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email Address</label>
                                <input type="email" className="w-full px-0 py-3 bg-transparent border-b border-border focus:border-primary focus:outline-none transition-colors" placeholder="john@example.com" />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Project Details</label>
                                <textarea rows={4} className="w-full px-0 py-3 bg-transparent border-b border-border focus:border-primary focus:outline-none transition-colors resize-none" placeholder="Tell us about your project..." />
                            </div>

                            <div className="pt-4">
                                <Button className="w-full rounded-md" size="lg">
                                    Send Message <Send className="w-4 h-4 ml-2" />
                                </Button>
                            </div>
                        </form>
                    </motion.div>

                </div>
            </div>
        </section>
    );
}
