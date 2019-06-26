import * as express from 'express';
import * as compression from 'compression';
import * as bodyParser from 'body-parser';
import * as helmet from 'helmet';
import { join } from 'path';
import { getApiConfig, ApiConfig } from './config';

const ejs = require('ejs');
const { postgraphile } = require('postgraphile');
const FilterPlugin = require('postgraphile-plugin-connection-filter');

export function startAPI(config: ApiConfig): void {
  const app = express();
  app.use(compression());
  app.use(bodyParser.json());
  app.use(helmet());

  // Rendering options for the index page
  app.engine('html', ejs.renderFile);
  app.set('views', join(__dirname, './views'));

  // Display a page at the subdomain root
  app.get('/', (_req, res) => res.render('index.html'));

  const graphqlConfig = {
    graphiql: true,
    graphqlRoute: '/v1',
    graphiqlRoute: '/v1/console',
    appendPlugins: [FilterPlugin],
    enableCors: true,
    watchPg: true,
  };

  const schemas = ['api'];

  // const readEntities = (dirPath: string, ext: string) => {
  //   return fromPairs(
  //     fs
  //       .readdirSync(dirPath)
  //       .filter(file => file.endsWith(ext))
  //       .map(file => file.substr(0, file.length - ext.length))
  //       .map(file => [file, fs.readFileSync(`${dirPath}/${file}${ext}`, 'utf-8')]),
  //   );
  // };

  // const allowedQueries = readEntities(join(__dirname, './queries'), '.graphql');
  // console.log(`allowed queries: ${Object.keys(allowedQueries).join(', ')}`);
  // const devMode = process.env.GRAPHQL_DEV;
  // console.log(`dev mode: ${devMode ? 'enabled' : 'disabled'}`);

  app.use(postgraphile(config.db, schemas, graphqlConfig));

  app.listen(config.api.port).on('listening', () => {
    console.log(`Running a GraphQL API server at http://localhost:${config.api.port}`);
  });
}

const rawPath = process.argv[3];
if (!rawPath) {
  throw new Error('You need to provide config as a first argument!');
}
const config = getApiConfig(process.env, rawPath);
startAPI(config);
