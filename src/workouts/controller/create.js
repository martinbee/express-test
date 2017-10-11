// refactor to await or promises
import mongoose from 'mongoose';

import Workout from '../model';
import User from '../../users/model';
import liftOrder from '../data/liftOrder';
import {
  isValidObjectId,
} from '../../utilities';
import {
  updateUserTrainingMax,
  getExercises,
} from '../utilities';

const createFirstWorkout = (userId, { res, next }) => {
  User.findById(userId).exec((err, user) => {
    if (err) return next(err);

    const { trainingMax } = user;

    const liftType = liftOrder[0];
    const liftTrainingMax = trainingMax[liftType];
    const week = 1;
    const exercises = getExercises(liftTrainingMax, week);

    const newWorkoutProps = {
      user,
      liftType,
      week,
      exercises,
    };

    return Workout.create(newWorkoutProps, (error, workout) => {
      if (error) return next(error);

      return res.send(workout);
    });
  });
};

const getLiftTypeIndex = liftType => liftOrder.indexOf(liftType);

const shouldRestartLiftOrder = (liftType) => {
  console.log(liftType);
  const liftTypeIndex = getLiftTypeIndex(liftType);
  console.log(liftTypeIndex === liftOrder.length - 1);

  return liftTypeIndex === liftOrder.length - 1;
};

const getNextLiftType = (lastLiftType) => {
  if (shouldRestartLiftOrder(lastLiftType)) return liftOrder[0];

  const nextLiftType = liftOrder[getLiftTypeIndex(lastLiftType) + 1];

  return nextLiftType;
};

const isEndOfMesocycle = (week, liftType) => {
  const isLastWeekOfCycle = week === 3;
  const isLastLiftOfCycle = shouldRestartLiftOrder(liftType);

  return isLastWeekOfCycle && isLastLiftOfCycle;
};

const getNewWorkoutWeek = (week, liftType) => {
  if (isEndOfMesocycle(week, liftType)) return 1;

  if (shouldRestartLiftOrder(liftType)) return week + 1;

  return week;
};

const addNewWorkout = (lastWorkoutCursor, { res, next }) => {
  const lastWorkout = lastWorkoutCursor[0];
  const { week, liftType, user } = lastWorkout;

  // updateUserTrainingMax weird pattern?
  const trainingMax = (
    isEndOfMesocycle(week, liftType) ? updateUserTrainingMax() : user.trainingMax
  );

  const nextLiftType = getNextLiftType(liftType);
  const liftTrainingMax = trainingMax[nextLiftType];
  const exercises = getExercises(liftTrainingMax, week);

  const newWorkoutProps = {
    user,
    liftType: nextLiftType,
    week: getNewWorkoutWeek(week, liftType),
    exercises,
  };

  Workout.create(newWorkoutProps, (err, workout) => {
    if (err) return next(err);

    return res.send(workout);
  });
};

const invalidIdError = 'Invalid id passed. Must be valid mongo object id.';

export default function create(req, res, next) {
  const { userId } = req.body;

  if (!isValidObjectId(userId)) return next(new Error(invalidIdError));

  const userObjectId = mongoose.Types.ObjectId(userId);

  const lastWorkoutQuery = {
    user: userObjectId,
  };
  const lastWorkoutFields = {
    liftType: 1,
    week: 1,
  };
  const lastWorkoutSort = {
    createdAt: -1,
  };

  // refactor express args into spread args? pull callback out below?

  // can't sort using findOne, have to grab all, limit, then use cursor
  return Workout.find(lastWorkoutQuery, lastWorkoutFields)
    .sort(lastWorkoutSort)
    .limit(1)
    .populate('user', 'trainingMax')
    .exec((err, lastWorkoutCursor) => {
      if (err) return next(err);

      const expressArgs = { req, res, next };
      const noWorkouts = !lastWorkoutCursor.length;

      if (noWorkouts) return createFirstWorkout(userId, expressArgs);

      return addNewWorkout(lastWorkoutCursor, expressArgs);
    });
}
