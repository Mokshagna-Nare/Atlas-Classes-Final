
/**
 * Atlas Classes Interactions
 * Handles scroll events, reveals, ripples, and nav highlights.
 * Dependency-free.
 */

export const initInteractions = () => {
    // 1. Scroll Reveal Observer
    const revealOptions = {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px"
    };

    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                // Optional: Stop observing once revealed for better performance
                revealObserver.unobserve(entry.target);
            }
        });
    }, revealOptions);

    document.querySelectorAll('.section-animate, .reveal-on-scroll').forEach(el => {
        revealObserver.observe(el);
    });

    // 2. Ripple Effect
    const addRippleEffect = (e: MouseEvent) => {
        const button = e.currentTarget as HTMLElement;
        const circle = document.createElement("span");
        const diameter = Math.max(button.clientWidth, button.clientHeight);
        const radius = diameter / 2;
        
        const rect = button.getBoundingClientRect();
        circle.style.width = circle.style.height = `${diameter}px`;
        circle.style.left = `${e.clientX - rect.left - radius}px`;
        circle.style.top = `${e.clientY - rect.top - radius}px`;
        circle.classList.add("ripple-effect");
        
        const existing = button.querySelector('.ripple-effect');
        if(existing) existing.remove();
        
        button.appendChild(circle);
    };

    // Attach ripple to all .btn and .ripple classes
    document.querySelectorAll('.btn, .ripple').forEach(btn => {
        (btn as HTMLElement).addEventListener('click', addRippleEffect as any);
    });

    // 3. Parallax Micro-motion
    const heroBg = document.querySelector('.hero-bg-parallax') as HTMLElement;
    if (heroBg && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        window.addEventListener('scroll', () => {
            const scrolled = window.scrollY;
            if (scrolled < window.innerHeight) {
                requestAnimationFrame(() => {
                    heroBg.style.transform = `translateY(${scrolled * 0.4}px) scale(1.05)`;
                });
            }
        }, { passive: true });
    }

    // 4. ScrollSpy (Nav Highlights)
    const sections = document.querySelectorAll('section[id], div[id]');
    const navLinks = document.querySelectorAll('.nav-link, nav button');

    const highlightNav = () => {
        const scrollY = window.scrollY;
        
        sections.forEach(current => {
            const section = current as HTMLElement;
            const sectionHeight = section.offsetHeight;
            const sectionTop = section.offsetTop - 150;
            const sectionId = section.getAttribute('id');

            if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
                navLinks.forEach(link => {
                    link.classList.remove('nav--active', 'text-brand');
                    const href = link.getAttribute('href') || '';
                    const onClick = link.getAttribute('onclick') || '';
                    
                    // Match either href or text content/onclick logic
                    if ((href.includes(sectionId || '')) || (onClick.includes(sectionId || ''))) {
                        link.classList.add('nav--active');
                    }
                });
            }
        });
    };

    window.addEventListener('scroll', highlightNav, { passive: true });
};
