import { motion as Motion } from 'framer-motion';
import { Check, Star } from 'lucide-react';

const appIcons = [
  { name: 'Dr. Humba', src: '/logos/drhumbalogonew.png' },
  { name: 'City of Talisay Chamber of Commerce', src: '/logos/talisaychamber.png' },
  { name: 'CPRMED', src: '/logos/cprmedlogo.png' },
  { name: 'Pater ni CJ', src: '/logos/paternicj.png' },
];

export const clientLogos = [
  { name: 'Dr. Humba', src: '/logos/drhumbalogonew.png' },
  { name: 'Chibs N Dink', src: '/logos/chibsndinknew.png' },
  { name: 'Sosyal Dinkers', src: '/logos/sosyaldinkers.png' },
  { name: 'Man and Paddle', src: '/logos/manandpaddle.png' },
  { name: 'KennyDink', src: '/logos/kennydinklogo.png' },
  { name: 'Talisay Chamber', src: '/logos/talisaychamber.png' },
  { name: 'Jump Serve Mandaue', src: '/logos/jumpservemandaue.png' },
  { name: 'CPRMED', src: '/logos/cprmedlogo.png' },
  { name: 'Jump Serve Mactan', src: '/logos/jumpservemactan.png' },
  { name: 'Pickleball Avenue', src: '/logos/nickleballavenue.png' },
  { name: 'The Pickle Point Cebu', src: '/logos/thepicklepoint.png' },
  { name: 'Firsel Tattoo', src: '/logos/firseltattoonew.png' },
  { name: 'Pater ni CJ', src: '/logos/paternicj.png' },
  { name: 'IMS-US', src: '/logos/ims-us.png' },
  { name: 'PDRRMO', src: '/logos/pdrrmo.jpg' },
  { name: 'Surigao del Norte', src: '/logos/surigaodelnorte.jpg' },
  { name: 'Slide Two', src: '/logos/slidetwo.png' },
  { name: 'The Halo Hub', src: '/logos/thehalohub.jpg' },
  { name: 'KBDF Luxury', src: '/logos/kbdflogotext.jpg' },
];

export function ClientProofBento() {
  return (
    <section id="clients" className="landing-section trusted-clients-section relative overflow-hidden" style={{ paddingTop: '2rem', paddingBottom: '4rem' }} aria-label="Social proof and metrics">
      {/* Subtle ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-cyan-500/5 blur-[140px] pointer-events-none rounded-full" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[300px] bg-emerald-500/5 blur-[120px] pointer-events-none rounded-full" />

      <div className="landing-shell max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Editorial Headline */}
        <Motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-8 md:mb-10"
        >
          <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-white mb-2 leading-none">
            don't take our word
          </h2>
          <p className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-white/35 leading-none">
            take theirs
          </p>
        </Motion.div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 lg:gap-6 mb-12 md:mb-16">
          
          {/* Card 1: Left Tall Fleet Card (spans 5 cols on md+) */}
          <Motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.7, delay: 0.05 }}
            className="md:col-span-5 rounded-[28px] bg-[#0c121a]/85 border border-white/10 hover:border-white/20 p-8 sm:p-10 flex flex-col justify-between shadow-2xl relative overflow-hidden backdrop-blur-xl group transition-all duration-300 min-h-[360px] md:min-h-[460px]"
          >
            {/* Subtle inner card sheen */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.04] via-transparent to-transparent pointer-events-none" />

            {/* Top: Free-floating 2x2 client logo layout (no enclosing boxes) */}
            <div className="relative z-10 mb-6">
              <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:gap-x-8 sm:gap-y-6 w-full max-w-[340px] mb-4 items-center">
                {appIcons.map((app) => (
                  <div
                    key={app.name}
                    className="h-16 sm:h-20 flex items-center justify-center transition-all duration-300 hover:scale-105"
                    title={app.name}
                  >
                    <img
                      src={app.src}
                      alt={`${app.name} logo`}
                      className="max-h-full max-w-[130px] sm:max-w-[150px] object-contain drop-shadow-lg"
                      loading="lazy"
                    />
                  </div>
                ))}
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.05] border border-white/10 text-xs font-medium text-white/60">
                <span>+18 more enterprise deployments</span>
              </div>
            </div>

            {/* Bottom: Stat and description */}
            <div className="relative z-10 pt-4">
              <span className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white block mb-2">
                25+ systems
              </span>
              <span className="text-2xl sm:text-3xl font-medium text-white/40 block leading-snug">
                running on odyssey
              </span>
            </div>
          </Motion.div>

          {/* Right Column Container (spans 7 cols on md+) */}
          <div className="md:col-span-7 flex flex-col gap-5 lg:gap-6">
            
            {/* Card 2: Top Right Wide Operations Metric */}
            <Motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.7, delay: 0.12 }}
              className="rounded-[28px] bg-[#0c121a]/85 border border-white/10 hover:border-white/20 p-8 sm:p-10 shadow-2xl relative overflow-hidden backdrop-blur-xl group transition-all duration-300 flex flex-col justify-between"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-white/[0.04] via-transparent to-transparent pointer-events-none" />

              {/* Status Pill Badge */}
              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs sm:text-sm font-semibold tracking-wide">
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Verified in production</span>
                </div>
              </div>

              {/* Stat & Label */}
              <div className="relative z-10 pt-8 sm:pt-10">
                <div className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white mb-2">
                  140,000+
                </div>
                <div className="text-base sm:text-lg text-white/45 font-medium">
                  court reservations & patient records processed
                </div>
              </div>
            </Motion.div>

            {/* Bottom 2-Card Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 lg:gap-6 flex-1">
              
              {/* Card 3: Ratings & Satisfaction */}
              <Motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.7, delay: 0.18 }}
                className="rounded-[28px] bg-[#0c121a]/85 border border-white/10 hover:border-white/20 p-7 sm:p-8 shadow-2xl relative overflow-hidden backdrop-blur-xl group transition-all duration-300 flex flex-col justify-between"
              >
                <div className="absolute inset-0 bg-gradient-to-b from-white/[0.04] via-transparent to-transparent pointer-events-none" />

                {/* 5 Vector Stars */}
                <div className="flex items-center gap-1.5 relative z-10" aria-label="5 out of 5 stars">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 sm:w-5 sm:h-5 fill-amber-400 text-amber-400" />
                  ))}
                </div>

                {/* Stat & Label */}
                <div className="relative z-10 pt-6">
                  <div className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white mb-1.5">
                    100%
                  </div>
                  <div className="text-sm sm:text-base text-white/45 font-medium leading-snug">
                    client delivery & renewal rate
                  </div>
                </div>
              </Motion.div>

              {/* Card 4: Revenue / Transaction Volume Impact */}
              <Motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.7, delay: 0.24 }}
                className="rounded-[28px] bg-[#0c121a]/85 border border-white/10 hover:border-white/20 p-7 sm:p-8 shadow-2xl relative overflow-hidden backdrop-blur-xl group transition-all duration-300 flex flex-col justify-between"
              >
                <div className="absolute inset-0 bg-gradient-to-b from-white/[0.04] via-transparent to-transparent pointer-events-none" />

                {/* Ascending Growth Bars */}
                <div className="flex items-end gap-1.5 h-6 relative z-10" aria-label="Growth trend indicator">
                  <span className="w-2 h-2.5 rounded-full bg-emerald-400/40" />
                  <span className="w-2 h-3.5 rounded-full bg-emerald-400/60" />
                  <span className="w-2 h-4.5 rounded-full bg-emerald-400/80" />
                  <span className="w-2 h-5.5 rounded-full bg-emerald-400" />
                  <span className="w-2 h-6 rounded-full bg-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                </div>

                {/* Stat & Label */}
                <div className="relative z-10 pt-6">
                  <div className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white mb-1.5">
                    ₱30M+
                  </div>
                  <div className="text-sm sm:text-base text-white/45 font-medium leading-snug">
                    platform transaction volume handled
                  </div>
                </div>
              </Motion.div>

            </div>

          </div>

        </div>

        {/* Foundation: Client Logo Grid */}
        <Motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="pt-6 border-t border-white/[0.08]"
        >
          <p className="text-center text-xs uppercase tracking-[0.22em] text-white/35 font-semibold mb-8">
            Trusted by Philippine enterprises, medical practices & sports operators
          </p>

          <div className="flex flex-wrap justify-center items-center gap-x-8 gap-y-8 sm:gap-x-12 sm:gap-y-10 md:gap-x-16 max-w-6xl mx-auto px-4">
            {clientLogos.map((item, index) => (
              <div
                key={`${item.name}-${index}`}
                className="flex justify-center items-center w-24 h-12 sm:w-28 sm:h-14 md:w-36 md:h-16 transition-all duration-300 opacity-40 grayscale hover:opacity-100 hover:grayscale-0 hover:scale-105"
                title={item.name}
              >
                <img
                  src={item.src}
                  alt={`${item.name} logo`}
                  loading="lazy"
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            ))}
          </div>
        </Motion.div>

      </div>
    </section>
  );
}
