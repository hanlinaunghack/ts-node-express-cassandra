import * as express from 'express';
import routes from './routes';

const app = express();

app.set('port', process.env.PORT || 3000);

app.use(routes);

app.listen(app.get('port'), () => {
    console.log(`App is running on port ${app.get('port')}`);
});