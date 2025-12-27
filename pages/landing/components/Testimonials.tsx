
import React, { useState, useEffect } from 'react';
import { TESTIMONIALS_DATA } from '../../../constants';
import { StarIcon, ArrowLeftIcon, ArrowRightIcon } from '../../../components/icons';

const Testimonials: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const prevSlide = () => {
    const isFirstSlide = currentIndex === 0;
    const newIndex = isFirstSlide ? TESTIMONIALS_DATA.length - 1 : currentIndex - 1;
    setCurrentIndex(newIndex);
  };

  const nextSlide = () => {
    const isLastSlide = currentIndex === TESTIMONIALS_DATA.length - 1;
    const newIndex = isLastSlide ? 0 : currentIndex + 1;
    setCurrentIndex(newIndex);
  };

  useEffect(() => {
    const timer = setTimeout(nextSlide, 5000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  const currentTestimonial = TESTIMONIALS_DATA[currentIndex];

  return (
    <section className="py-20 bg-atlas-gray">
      <div className="container mx-auto px-6 text-center">
        <h2 className="text-4xl font-extrabold mb-4">What Our Students and Partners Say</h2>
        <div className="w-24 h-1 bg-atlas-orange mx-auto mb-12"></div>
        <div className="relative max-w-3xl mx-auto">
          <div className="overflow-hidden relative h-64">
            {TESTIMONIALS_DATA.map((testimonial, index) => (
              <div
                key={testimonial.id}
                className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                  index === currentIndex ? 'opacity-100' : 'opacity-0'
                }`}
              >
                {index === currentIndex && (
                  <div className="flex flex-col items-center justify-center h-full">
                    <p className="text-xl italic text-gray-300 mb-4">"{currentTestimonial.quote}"</p>
                    <div className="flex mb-2">
                        {[...Array(5)].map((_, i) => (
                            <StarIcon key={i} className={`h-5 w-5 ${i < currentTestimonial.rating ? 'text-yellow-400' : 'text-gray-600'}`} />
                        ))}
                    </div>
                    <p className="font-bold text-white">{currentTestimonial.author}</p>
                    <p className="text-sm text-gray-400">{currentTestimonial.title}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
          <button onClick={prevSlide} className="absolute top-1/2 -translate-y-1/2 left-0 md:-left-16 p-2 rounded-full bg-atlas-black/50 hover:bg-atlas-black text-white transition">
            <ArrowLeftIcon className="h-6 w-6" />
          </button>
          <button onClick={nextSlide} className="absolute top-1/2 -translate-y-1/2 right-0 md:-right-16 p-2 rounded-full bg-atlas-black/50 hover:bg-atlas-black text-white transition">
            <ArrowRightIcon className="h-6 w-6" />
          </button>
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
