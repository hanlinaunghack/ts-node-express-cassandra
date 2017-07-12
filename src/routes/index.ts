import * as express from 'express';
import { SimpleStrategy } from '../lib';
import * as db from '../lib/db';

const routes = express.Router();

db.createKeyspace('examples', new SimpleStrategy(3));

routes.get('/hello', (req, res) => {
    res.json({
        message: 'Hello World!'
    });
});

export default routes;