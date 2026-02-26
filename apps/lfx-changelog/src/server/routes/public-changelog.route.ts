import { Router } from 'express';

import { ChangelogController } from '../controllers/changelog.controller';

const router = Router();
const changelogController = new ChangelogController();

router.get('/', (req, res, next) => changelogController.listPublished(req, res, next));
router.get('/:id', (req, res, next) => changelogController.getPublishedById(req, res, next));

export default router;
