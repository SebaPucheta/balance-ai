# Balance AI Agent

This project implements a serverless AI agent using AWS Lambda, LangChain, and OpenAI. The agent can interact with a Firestore database to answer questions about financial transactions.

## Tools and Technologies

*   **AWS Lambda**: For running the serverless function.
*   **Amazon DynamoDB**: For storing chat memory.
*   **Google Firestore**: As the main data source for the agent.
*   **LangChain**: For building the AI agent and managing interactions with the language model and tools.
*   **OpenAI**: Provides the language model (GPT-4 or similar).
*   **Serverless Framework**: For deploying and managing the AWS resources.
*   **TypeScript**: The programming language used.
*   **ESLint**: For code linting.

## Important Scripts

*   `npm run lint`: Lints the code using ESLint.
*   `npm run package:dev`: Packages the serverless application for the `dev` stage.
*   `npm run deploy:dev`: Deploys the serverless application to the `dev` stage in `us-east-1`.

## Setup

1.  Copy the `.env.sample` file to `.env` and fill in the required environment variables:
    *   `OPENAI_API_KEY`: Your OpenAI API key.
    *   `GOOGLE_PROJECT_ID`: Your Google Cloud project ID.
    *   `GOOGLE_APPLICATION_CREDENTIALS`: The path to your Google Cloud service account JSON file.
2.  Install the dependencies: `npm install`

## Usage

You can invoke the deployed Lambda function with a POST request to its endpoint. The request body should be a JSON object with the following structure:

```json
{
  "userId": "some-user-id",
  "input": "What were my last 5 transactions?"
}
```
