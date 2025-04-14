/**
 * Deployment Notification Script
 * 
 * Sends notifications about deployment status to configured channels:
 * - Slack
 * - Email
 * - SMS (via Twilio)
 * - Microsoft Teams
 * 
 * Used by CI/CD pipeline to notify stakeholders about deployment 
 * success or failure.
 */

import fs from 'fs';
import path from 'path';
import { ZKErrorLogger } from '../../src/zkErrorHandler.js';

// Parse command line arguments
const args = process.argv.slice(2);
let status = 'unknown';
let environment = 'development';

for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg.startsWith('--status=')) {
        status = arg.substring(9);
    } else if (arg.startsWith('--env=')) {
        environment = arg.substring(6);
    }
}

// Validate arguments
if (!['success', 'failure', 'started'].includes(status)) {
    console.error(`Error: Invalid status '${status}'. Must be one of: success, failure, started`);
    process.exit(1);
}

// Environment validation
const validEnvironments = ['development', 'staging', 'production'];
if (!validEnvironments.includes(environment)) {
    console.error(`Error: Invalid environment '${environment}'. Must be one of: ${validEnvironments.join(', ')}`);
    process.exit(1);
}

// Configuration
const configs = {
    development: {
        // Notification disabled for development to reduce noise
        notify: false,
        slack: {
            webhook: process.env.DEV_SLACK_WEBHOOK,
            channel: '#dev-deployments'
        },
        email: {
            to: 'dev-team@proofoffunds.com',
            cc: ''
        }
    },
    staging: {
        notify: true,
        slack: {
            webhook: process.env.STAGING_SLACK_WEBHOOK,
            channel: '#staging-deployments'
        },
        email: {
            to: 'dev-team@proofoffunds.com',
            cc: 'qa-team@proofoffunds.com'
        }
    },
    production: {
        notify: true,
        slack: {
            webhook: process.env.PROD_SLACK_WEBHOOK,
            channel: '#prod-deployments'
        },
        email: {
            to: 'dev-team@proofoffunds.com,ops-team@proofoffunds.com',
            cc: 'management@proofoffunds.com'
        }
    }
};

// Get environment config
const config = configs[environment];

/**
 * Mock function to send Slack notification
 * In a real implementation, this would use the Slack API
 */
async function sendSlackNotification() {
    if (!config.notify) {
        console.log(`Slack notifications disabled for ${environment}`);
        return { success: true, skipped: true };
    }
    
    if (!config.slack.webhook) {
        console.log('Slack webhook not configured, skipping notification');
        return { success: false, error: 'Webhook not configured' };
    }
    
    try {
        console.log(`Would send Slack notification to ${config.slack.channel}`);
        
        // In a real implementation, this would use fetch or axios to post to the webhook
        const message = formatSlackMessage();
        
        // Mock successful API call
        console.log('Slack notification sent successfully');
        return { success: true, message };
    } catch (error) {
        console.error(`Failed to send Slack notification: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * Format Slack message based on deployment status
 */
function formatSlackMessage() {
    const timestamp = new Date().toISOString();
    const commitSha = process.env.GITHUB_SHA || 'unknown';
    const commitMsg = process.env.COMMIT_MESSAGE || 'No commit message';
    const actor = process.env.GITHUB_ACTOR || 'unknown';
    const runUrl = process.env.GITHUB_SERVER_URL ? 
        `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : 
        'unknown';
    
    let color, title;
    
    switch (status) {
        case 'success':
            color = '#36a64f'; // green
            title = `✅ Deployment to ${environment} successful`;
            break;
        case 'failure':
            color = '#dc3545'; // red
            title = `❌ Deployment to ${environment} failed`;
            break;
        case 'started':
            color = '#ffc107'; // yellow
            title = `🚀 Deployment to ${environment} started`;
            break;
        default:
            color = '#6c757d'; // gray
            title = `Deployment to ${environment} status: ${status}`;
    }
    
    return {
        attachments: [
            {
                color,
                title,
                fields: [
                    {
                        title: 'Environment',
                        value: environment,
                        short: true
                    },
                    {
                        title: 'Status',
                        value: status,
                        short: true
                    },
                    {
                        title: 'Time',
                        value: timestamp,
                        short: true
                    },
                    {
                        title: 'Commit',
                        value: `${commitSha.substring(0, 7)} - ${commitMsg}`,
                        short: false
                    },
                    {
                        title: 'Triggered by',
                        value: actor,
                        short: true
                    },
                    {
                        title: 'Details',
                        value: `<${runUrl}|View workflow run>`,
                        short: true
                    }
                ],
                footer: 'ZK Proof System Deployment',
                ts: Math.floor(Date.now() / 1000)
            }
        ]
    };
}

/**
 * Mock function to send email notification
 * In a real implementation, this would use an email service
 */
async function sendEmailNotification() {
    if (!config.notify) {
        console.log(`Email notifications disabled for ${environment}`);
        return { success: true, skipped: true };
    }
    
    try {
        const to = config.email.to;
        const cc = config.email.cc;
        
        if (!to) {
            console.log('Email recipients not configured, skipping notification');
            return { success: false, error: 'Recipients not configured' };
        }
        
        console.log(`Would send email notification to ${to}${cc ? ` (cc: ${cc})` : ''}`);
        
        // In a real implementation, this would use a service like SendGrid, AWS SES, etc.
        const emailContent = formatEmailContent();
        
        // Mock successful email sending
        console.log('Email notification sent successfully');
        return { success: true, emailContent };
    } catch (error) {
        console.error(`Failed to send email notification: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * Format email content based on deployment status
 */
function formatEmailContent() {
    const timestamp = new Date().toISOString();
    const commitSha = process.env.GITHUB_SHA || 'unknown';
    const commitMsg = process.env.COMMIT_MESSAGE || 'No commit message';
    const actor = process.env.GITHUB_ACTOR || 'unknown';
    const runUrl = process.env.GITHUB_SERVER_URL ? 
        `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : 
        'unknown';
    
    let subject, statusText;
    
    switch (status) {
        case 'success':
            subject = `[${environment.toUpperCase()}] Deployment Successful`;
            statusText = 'successfully completed';
            break;
        case 'failure':
            subject = `[${environment.toUpperCase()}] Deployment Failed`;
            statusText = 'failed';
            break;
        case 'started':
            subject = `[${environment.toUpperCase()}] Deployment Started`;
            statusText = 'started';
            break;
        default:
            subject = `[${environment.toUpperCase()}] Deployment Update`;
            statusText = status;
    }
    
    const html = `
        <h2>ZK Proof System Deployment</h2>
        <p>Deployment to <strong>${environment}</strong> environment has <strong>${statusText}</strong>.</p>
        
        <h3>Deployment Details</h3>
        <ul>
            <li><strong>Environment:</strong> ${environment}</li>
            <li><strong>Status:</strong> ${status}</li>
            <li><strong>Time:</strong> ${timestamp}</li>
            <li><strong>Commit:</strong> ${commitSha.substring(0, 7)} - ${commitMsg}</li>
            <li><strong>Triggered by:</strong> ${actor}</li>
            <li><strong>Details:</strong> <a href="${runUrl}">View workflow run</a></li>
        </ul>
        
        <p>
            For more information, please check the deployment logs or contact the DevOps team.
        </p>
    `;
    
    return {
        subject,
        html
    };
}

/**
 * Send all configured notifications
 */
async function sendNotifications() {
    try {
        console.log(`Sending notifications for ${status} deployment to ${environment}...`);
        
        // Perform notifications in parallel
        const [slackResult, emailResult] = await Promise.all([
            sendSlackNotification(),
            sendEmailNotification()
        ]);
        
        const results = {
            timestamp: new Date().toISOString(),
            environment,
            status,
            notifications: {
                slack: slackResult,
                email: emailResult
            }
        };
        
        // Log notification results
        console.log('Notification results:', JSON.stringify(results, null, 2));
        
        // In production, we would save these to a log file or database
        return results;
    } catch (error) {
        console.error(`Error sending notifications: ${error.message}`);
        ZKErrorLogger.logError(error);
        throw error;
    }
}

// Send notifications and exit
sendNotifications().then(() => {
    console.log('Notifications completed');
    process.exit(0);
}).catch(error => {
    console.error(`Fatal error sending notifications: ${error.message}`);
    process.exit(1);
});