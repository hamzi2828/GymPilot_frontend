"use client";

import React from "react";

// interface Exercise {
//   name: string;
//   image: string;
//   sets: string;
//   reps: string;
//   rest: string;
//   tips: string;
// }

interface MainContentProps {
  content: string;
  workoutOverview?: {
    duration: string;
    difficulty: string;
    equipment: string;
    targetMuscles: string[];
  };
}

const MainContent: React.FC<MainContentProps> = ({
  content,
}) => {
  // const defaultExercises: Exercise[] = [
  //   {
  //     name: "Barbell Squats",
  //     image: "/images/exercise-squat.svg",
  //     sets: "4 sets",
  //     reps: "8-12 reps",
  //     rest: "2-3 min",
  //     tips: "Keep your core tight and chest up throughout the movement"
  //   },
  //   {
  //     name: "Deadlifts",
  //     image: "/images/exercise-deadlift.svg",
  //     sets: "4 sets",
  //     reps: "6-8 reps",
  //     rest: "3-4 min",
  //     tips: "Focus on hip hinge movement and keep the bar close to your body"
  //   },
  //   {
  //     name: "Bench Press",
  //     image: "/images/exercise-bench.svg",
  //     sets: "4 sets",
  //     reps: "8-10 reps",
  //     rest: "2-3 min",
  //     tips: "Control the descent and drive through your feet"
  //   },
  //   {
  //     name: "Pull-ups",
  //     image: "/images/exercise-pullup.svg",
  //     sets: "3 sets",
  //     reps: "6-10 reps",
  //     rest: "2-3 min",
  //     tips: "Engage your lats and avoid swinging movements"
  //   }
  // ];



  return (
    <div className="max-w-4xl" >
      <div
        className="prose prose-lg prose-invert mb-12"
        dangerouslySetInnerHTML={{ __html: content }}
      />


      {/* <div className="mb-12">
        <h3 className="font-montserrat font-bold text-3xl mb-8 text-white">
          Exercise Breakdown
        </h3>
        <div className="space-y-6">
          {displayExercises.map((exercise, index) => (
            <div
              key={index}
              className="gym-blog-custom-bg-darker rounded-2xl p-6 hover:gym-blog-hover-lift transition-all duration-300"
            >
              <div className="flex flex-col lg:flex-row gap-6">
                <div className="lg:w-1/3">
                  <div className="relative h-48 lg:h-32 rounded-xl overflow-hidden">
                    <Image
                      src={exercise.image}
                      alt={exercise.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                </div>
                <div className="lg:w-2/3">
                  <h4 className="font-bold text-xl mb-4 text-white">
                    {exercise.name}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    <div>
                      <span className="text-gym-green font-semibold">Sets: </span>
                      <span className="text-gray-300">{exercise.sets}</span>
                    </div>
                    <div>
                      <span className="text-gym-green font-semibold">Reps: </span>
                      <span className="text-gray-300">{exercise.reps}</span>
                    </div>
                    <div>
                      <span className="text-gym-green font-semibold">Rest: </span>
                      <span className="text-gray-300">{exercise.rest}</span>
                    </div>
                  </div>
                  <div className="gym-blog-custom-bg-dark p-4 rounded-xl">
                    <h5 className="font-semibold text-gym-green mb-2">Pro Tip:</h5>
                    <p className="text-gray-300 text-sm">{exercise.tips}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="gym-blog-custom-bg-darker rounded-2xl p-8 mb-12">
        <h3 className="font-montserrat font-bold text-2xl mb-6 text-white">
          Key Takeaways
        </h3>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <i className="fas fa-check-circle gym-blog-custom-text-green mt-1"></i>
            <p className="text-gray-300">
              Focus on compound movements for maximum muscle engagement and strength gains
            </p>
          </div>
          <div className="flex items-start gap-3">
            <i className="fas fa-check-circle gym-blog-custom-text-green mt-1"></i>
            <p className="text-gray-300">
              Progressive overload is key - gradually increase weight, reps, or sets each week
            </p>
          </div>
          <div className="flex items-start gap-3">
            <i className="fas fa-check-circle gym-blog-custom-text-green mt-1"></i>
            <p className="text-gray-300">
              Proper form is more important than lifting heavy weights
            </p>
          </div>
          <div className="flex items-start gap-3">
            <i className="fas fa-check-circle gym-blog-custom-text-green mt-1"></i>
            <p className="text-gray-300">
              Allow adequate rest between sessions for optimal recovery and growth
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 mb-8">
        <span className="gym-blog-custom-bg-green text-black px-4 py-2 rounded-full text-sm font-semibold">
          Strength Training
        </span>
        <span className="gym-blog-custom-bg-dark text-white px-4 py-2 rounded-full text-sm">
          Beginner Friendly
        </span>
        <span className="gym-blog-custom-bg-dark text-white px-4 py-2 rounded-full text-sm">
          Compound Movements
        </span>
        <span className="gym-blog-custom-bg-dark text-white px-4 py-2 rounded-full text-sm">
          Full Body
        </span>
      </div>

      <div className="flex items-center justify-between py-8 border-t border-gray-700">
        <div className="flex items-center gap-4">
          <span className="text-gray-400">Share this article:</span>
          <div className="flex gap-3">
            <button className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors">
              <i className="fab fa-facebook-f"></i>
            </button>
            <button className="w-10 h-10 bg-blue-400 text-white rounded-full flex items-center justify-center hover:bg-blue-500 transition-colors">
              <i className="fab fa-twitter"></i>
            </button>
            <button className="w-10 h-10 bg-blue-800 text-white rounded-full flex items-center justify-center hover:bg-blue-900 transition-colors">
              <i className="fab fa-linkedin-in"></i>
            </button>
            <button className="w-10 h-10 bg-green-600 text-white rounded-full flex items-center justify-center hover:bg-green-700 transition-colors">
              <i className="fab fa-whatsapp"></i>
            </button>
          </div>
        </div>
        <button className="flex items-center gap-2 text-gray-400 hover:text-gym-green transition-colors">
          <i className="far fa-bookmark"></i>
          Save for later
        </button>
      </div> */}
    </div>
  );
};

export default MainContent;