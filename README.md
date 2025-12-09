# VolunteerHub - Final Project Report

## Team Information
- **Yaming Liu**
    - Student Number: 1006871440
    - Email: yaming.liu@mail.utoronto.ca
- **Dhruvi Patel**
    - Student Number: 1006310939
    - Email: dhruviii.patel@mail.utoronto.ca

## Demo Video
Google Drive Link: 

## Motivation
Coordinating volunteers is a surprisingly hard and time-consuming task for small organizations and community groups. Most teams still rely on a mix of Google Sheets, Excel files, email threads, WhatsApp groups, or paper sign-up sheets. These methods are slow, error-prone, and provide no reliable way of knowing who has actually committed to volunteering. When event details or attendance of volunteers changes at the last minute, updating everyone becomes nearly impossible, and coordinators often spend hours manually trying to get responses.

Although existing commercial solutions exist, most small groups would not want to pay monthly fees, share their member data with third parties, or learn complex platforms. A simple self-hosted and free tool like VolunteerHub, would suffice.

That's why we built VolunteerHub. We kept the scope minimal and focused on a clean REST API instead of building a full user interface. Our goal was to create a backend that is extremely easy to understand, test, deploy, and maintain, while still demonstrating every required cloud concept in depth. A simple, well-documented API can be used immediately with tools like Postman or curl, and an optional frontend can always be added later if desired. This decision allowed us to deliver a fully containerized, orchestrated, monitored, continuously deployed, and automatically backed-up system within the course timeline without sacrificing quality.

VolunteerHub directly solves the real coordination problem we experience every semester in student clubs, and it gave us the perfect way to master Docker, Docker Compose, Docker Swarm, persistent volumes, orchestration, monitoring, CI/CD, and backup strategies, as laid out in the learning objectives of ECE1779.

## Objective

The primary objective of this project was to design, implement, and deploy a fully functional, stateful, cloud-native application that satisfies all technical requirements of ECE1779 while remaining simple, reliable, and useful in real life.
Through this implementation, we specifically aimed to:

- Build a centralized volunteer coordination platform (VolunteerHub) that allows coordinators to create, edit, and delete events, assign volunteers, and see who has accepted, marked tentative, or declined, and that allows volunteers to view their assigned events and update their participation status.
- Demonstrate mastery of every core cloud computing concept taught in the course:
    - Containerization of the Node.js + Express backend and PostgreSQL using Docker
    - Multi-container local development with Docker Compose
    - Persistent storage using a DigitalOcean Volume so data survives container restarts, redeployments, and Droplet reboots
    - Production orchestration using Docker Swarm with two API replicas, built-in load balancing, rolling updates, and automatic restart policies
    - Health endpoints (/health/alive and /health/db) and monitoring via DigitalOcean built-in graphs and email alerts and also local cAdvisor
- Implement two complete advanced features:
    - Establishing fully automated nightly PostgreSQL backups to DigitalOcean Spaces with a tested one-command restore capability
    - Achieving secure, automated, zero-downtime continuous deployment via a GitHub Actions CI/CD pipeline that builds, pushes the image, and triggers a rolling update on the Swarm cluster

- Keep the system lightweight by delivering a clean, well-documented REST API instead of a frontend, making it instantly usable with Postman or curl and easy for future extensions, while ensuring the entire stack can be deployed and operated by any small groups with almost no overhead.

## Technical Stack


## Features


## User Guide


## Development Guide


## Deployment Information


## Individual Contributions

## Lessons Learned and Concluding Remarks
