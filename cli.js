#!/usr/bin/env node
const pkg = require('./package.json');
const config = require('./config');
const program = require('commander');
const invite = require('./invite');
const redis = require('./redis');
const Table = require('cli-table');
const web = require('./web');
const pubsub = require('./pubsub');
const logger = require('./logger');
const { db, Configuration, Installation, Team, User } = require('./models');

// Set the package version.
program.version(pkg.version);

program
  .command('serve')
  .description('starts the application server')
  .option(
    '-w, --web_only',
    'only starts the web server, does not start the pubsub subscriber'
  )
  .option(
    '-p, --pubsub_only',
    'only starts the pubsub subscriber, does not start the web server'
  )
  .action(options => {
    if (options.pubsub_only || !options.web_only) {
      pubsub.subscribe();
      logger.debug('subscribed to the pubsub topic', {
        web_only: options.web_only,
        pubsub_only: options.pubsub_only,
      });
    }

    if (options.web_only || !options.pubsub_only) {
      web.listen();
      logger.debug('started the web server', {
        web_only: options.web_only,
        pubsub_only: options.pubsub_only,
      });
    }
  });

program
  .command('invite <domain>')
  .description('creates a slack domain join link')
  .action(async domain => {
    try {
      const token = await invite.create(domain);
      console.log('Invite token');
      console.log(config.get('root_url') + 'invite/' + token);
      redis.disconnect();
      db.close();
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  });

program
  .command('stats')
  .description('show current stats')
  .action(async () => {
    try {
      const [configs, installs, teams, users] = await Promise.all([
        Configuration.find().count(),
        Installation.find().count(),
        Team.find().count(),
        User.find().count(),
      ]);

      const table = new Table();
      table.push(
        { Configurations: configs },
        { Installations: installs },
        { Teams: teams },
        { Users: users }
      );

      console.log(table.toString());
      redis.disconnect();
      db.close();
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  });

program
  .command('disable <teamID>')
  .description(
    'disables a team from logging in and having their comments processed'
  )
  .action(async teamID => {
    try {
      const team = await Team.findOneAndUpdate(
        { id: teamID },
        { $set: { disabled: true } }
      );
      if (!team) {
        throw new Error(`Team ${teamID} not found`);
      }

      console.log(`Team ${teamID} was disabled.`);
      redis.disconnect();
      db.close();
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  });

program
  .command('enable <teamID>')
  .description(
    'enables a team so they can log in and have their comments processed'
  )
  .action(async teamID => {
    try {
      const team = await Team.findOneAndUpdate(
        { id: teamID },
        { $set: { disabled: false } }
      );
      if (!team) {
        throw new Error(`Team ${teamID} not found`);
      }

      console.log(`Team ${teamID} was enabled.`);
      redis.disconnect();
      db.close();
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  });

program
  .command('teams')
  .description('show all the existing teams')
  .option('-a, --show_all', 'Shows all teams (default shows just enabled)')
  .action(async options => {
    try {
      const query = Team.where({});

      if (!options.show_all) {
        query.merge({
          disabled: false,
        });
      }

      const teams = await query.sort('ID');

      if (teams.length !== 0) {
        const table = new Table({
          head: ['ID', 'Name', 'Domain', 'Created', 'Enabled'],
        });

        for (const team of teams) {
          table.push([
            team.id,
            team.name,
            team.domain,
            team.created_at.toString(),
            team.disabled ? 'No' : 'Yes',
          ]);
        }

        console.log(table.toString());
      } else {
        console.log('There are no teams to display.');
      }

      redis.disconnect();
      db.close();
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  });

program.command('*', '', { noHelp: true, isDefault: true }).action(function() {
  redis.disconnect();
  db.close();
  program.outputHelp();
});

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  redis.disconnect();
  db.close();
  program.outputHelp();
}
