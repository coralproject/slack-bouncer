# slack-bouncer

The Slack Bouncer application is designed to provide an interface for managing
Talk installations that are connected to Slack. We provide a hosted version at
https://slack.coralproject.net/ and encourage organizations to self-host if they
want more control over the experience.

At the moment, we have a strict requirement to deploy this within the Google
Cloud Platform as we leverage some technology there to keep these systems
running smooth under high load. We plan in the future to remove this
requirement.

Built with <3 by The Coral Project & Mozilla.

## Requirements

- MongoDB
- Redis
- NodeJS
- Google Cloud Platform
  - Google Cloud Functions (for ingesting comments)
  - Google Cloud Pub/Sub (for buffering the ingested comments)

## Configuration

Refer to the [config.js](/config.js) for all the configuration injested into
Talk.

## License

Slack Bouncer is released under the [Apache License, v2.0](/LICENSE).
