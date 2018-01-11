const config = require('./config');
const mongoose = require('mongoose');

// Plug native ES6 promises.
mongoose.Promise = global.Promise;

const Schema = mongoose.Schema;
const db = mongoose.connect(config.get('mongo_url'), {
  useMongoClient: true,
});

const UserSchema = new Schema(
  {
    id: {
      type: String,
      unique: true,
      required: true,
    },
    name: String,
    access_token: String,
    team_id: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: {
      updatedAt: 'updated_at',
      createdAt: 'created_at',
    },
  }
);

UserSchema.set('toObject', {
  transform: (doc, ret) => {
    delete ret.access_token;
    return ret;
  },
});

const User = mongoose.model('User', UserSchema);

const ConfigurationSchema = new Schema(
  {
    id: {
      type: String,
      unique: true,
      required: true,
    },
    team_id: String,
    added_by: Object,
    installation_id: String,
    disabled: {
      type: Boolean,
      default: false,
    },
    type: {
      type: String,
      enum: ['NEW', 'REPORTED', 'PREMOD'],
      default: 'NEW',
    },
    channel: String,
    channel_id: String,
  },
  {
    timestamps: {
      updatedAt: 'updated_at',
      createdAt: 'created_at',
    },
  }
);

const Configuration = mongoose.model('Configuration', ConfigurationSchema);

const Installation = mongoose.model(
  'Installation',
  new Schema(
    {
      id: {
        type: String,
        unique: true,
        required: true,
      },
      name: {
        type: String,
        required: true,
      },
      root_url: {
        type: String,
        required: true,
      },
      access_token: {
        type: String,
        required: true,
      },
      disabled: {
        type: Boolean,
        default: false,
      },
      team_id: {
        type: String,
        required: true,
      },
      talk_version: {
        type: String,
        required: true,
      },
      added_by: Object,
    },
    {
      timestamps: {
        updatedAt: 'updated_at',
        createdAt: 'created_at',
      },
    }
  )
);

const Team = mongoose.model(
  'Team',
  new Schema(
    {
      id: {
        type: String,
        unique: true,
        required: true,
      },
      name: String,
      domain: String,
      disabled: {
        type: Boolean,
        default: false,
      },
    },
    {
      timestamps: {
        updatedAt: 'updated_at',
        createdAt: 'created_at',
      },
    }
  )
);

module.exports = {
  db,
  Configuration,
  Installation,
  Team,
  User,
};
