import { useState, useRef, useEffect } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';

export const Chatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello! 👋 How can I help you today? Please select an option below:'
    }
  ]);
  // eslint-disable-next-line no-unused-vars
  const [showButtons, setShowButtons] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const quickResponses = {
    services: {
      question: "What services do you offer?",
      answer: "We offer a variety of services including web development, UI/UX design, mobile app development, digital marketing, and consulting. Each service is tailored to meet your specific business needs!"
    },
    portfolio: {
      question: "Show me your portfolio",
      answer: "You can check out our portfolio section on this page to see our latest projects and case studies. We've worked on various exciting projects across different industries including e-commerce, healthcare, and fintech!"
    },
    pricing: {
      question: "How much does it cost?",
      answer: "Our pricing varies depending on the project scope and requirements. We offer flexible packages starting from basic to enterprise level. Please contact us with your specific needs, and we'll provide a customized quote within 24 hours!"
    },
    contact: {
      question: "How can I contact you?",
      answer: "You can reach us through the contact form on this page, or email us directly. We typically respond within 24 hours on business days. You can also connect with us on our social media channels!"
    },
    timeline: {
      question: "What's the project timeline?",
      answer: "Project timelines vary based on complexity and scope. Typically, projects range from 2-12 weeks. We follow an agile approach with regular updates and milestones. Contact us to discuss your specific timeline needs!"
    },
    technology: {
      question: "What technologies do you use?",
      answer: "We use modern, cutting-edge technologies including React, Node.js, Next.js, TypeScript, Tailwind CSS, and various cloud services like AWS and Vercel to build scalable, performant, and secure solutions!"
    }
  };

  const handleQuickResponse = (key) => {
    const response = quickResponses[key];

    // Add user question
    setMessages(prev => [...prev, {
      role: 'user',
      content: response.question
    }]);

    // Add bot answer after a delay
    setTimeout(() => {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response.answer
      }]);

      // Show buttons again after response
      setTimeout(() => {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Is there anything else I can help you with?'
        }]);
      }, 500);
    }, 800);
  };

  const handleLiveAgent = () => {
    setMessages(prev => [...prev, {
      role: 'user',
      content: 'Connect me to a live agent'
    }]);

    setIsLoading(true);

    // Show loading for 10 seconds before showing the message
    setTimeout(() => {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '❌ No agents are online today. Please try again another time or use the contact form for inquiries. We typically respond within 24 hours!'
      }]);
      setIsLoading(false);
    }, 10000); // 10 seconds delay
  };

  return (
    <>
      {/* Chat Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 bg-black text-white dark:bg-white dark:text-black rounded-full p-4 shadow-xl hover:scale-105 transition-all duration-300 flex items-center justify-center border border-transparent dark:border-white/20"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.svg
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </motion.svg>
          ) : (
            <motion.svg
              key="chat"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </motion.svg>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.8 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-24 right-6 z-50 w-96 h-[600px] bg-background rounded-xl shadow-lg flex flex-col overflow-hidden border border-border/50 backdrop-blur-sm"
          >
            {/* Header */}
            <div className="bg-background/80 backdrop-blur-md p-4 text-foreground border-b border-border/50 flex items-center justify-between">
              <div>
                <h3 className="font-medium text-sm">Assistant</h3>
                <p className="text-xs text-foreground/60">Typically replies instantly</p>
              </div>
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 ${message.role === 'user'
                        ? 'bg-foreground text-background rounded-br-sm'
                        : 'bg-muted text-foreground rounded-bl-sm border border-border/50'
                      }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                </motion.div>
              ))}

              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="bg-muted text-foreground rounded-2xl rounded-bl-sm border border-border/50 px-4 py-3">
                    <div className="flex items-center space-x-2">
                      <div className="flex space-x-1">
                        <div className="w-1.5 h-1.5 bg-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-1.5 h-1.5 bg-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-1.5 h-1.5 bg-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Response Buttons */}
            <div className="p-4 bg-background/50 backdrop-blur border-t border-border/50 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleQuickResponse('services')}
                  className="px-3 py-2 text-xs font-medium bg-muted hover:bg-muted/80 text-foreground rounded-full transition-colors border border-border/50"
                >
                  Services
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleQuickResponse('portfolio')}
                  className="px-3 py-2 text-xs font-medium bg-muted hover:bg-muted/80 text-foreground rounded-full transition-colors border border-border/50"
                >
                  Portfolio
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleQuickResponse('pricing')}
                  className="px-3 py-2 text-xs font-medium bg-muted hover:bg-muted/80 text-foreground rounded-full transition-colors border border-border/50"
                >
                  Pricing
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleQuickResponse('contact')}
                  className="px-3 py-2 text-xs font-medium bg-muted hover:bg-muted/80 text-foreground rounded-full transition-colors border border-border/50"
                >
                  Contact
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleQuickResponse('timeline')}
                  className="px-3 py-2 text-xs font-medium bg-muted hover:bg-muted/80 text-foreground rounded-full transition-colors border border-border/50"
                >
                  Timeline
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleQuickResponse('technology')}
                  className="px-3 py-2 text-xs font-medium bg-muted hover:bg-muted/80 text-foreground rounded-full transition-colors border border-border/50"
                >
                  Technology
                </motion.button>
              </div>

              {/* Live Agent Button */}
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={handleLiveAgent}
                className="w-full px-4 py-2.5 text-xs font-medium bg-foreground text-background rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>Connect to Live Agent</span>
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};