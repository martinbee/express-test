import express from 'express';

import {
  list,
  create,
  show,
  update,
} from './controller';

const router = express.Router();

// /workouts
router.route('/')
  .get(list)
  .post(create);

router.route('/:id')
  .get(show)
  .patch(update);

export default router;
