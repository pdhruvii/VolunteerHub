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

Dhruvi Patel and Yaming Liu worked as an extremely collaborative team from the beginning until submission. We screen-shared, shared files, and pair-programmed very frequently. We designed everything together, and constantly reviewed each other's work. The Git history shows large final commits because we only pushed once the files and entire system were fully tested and polished together.

Dhruvi Patel took primary ownership of the application core and security foundations while always collaborating closely with Yaming. She designed and implemented the complete PostgreSQL schema with all tables, UUID keys, relationships, cascades, and the assignment status. She wrote the registration and login endpoints with bcrypt hashing and validation, the full event CRUD operations (create, list, retrieve, update, delete) with creator-only rules, the volunteer assignment creation and removal endpoints, and the volunteer status update endpoint. She implemented the JWT authentication middleware (signing, verification, and Bearer token extraction), the dev-time impersonation system using the X-Dev-User header, and the role-based requireRole checks. She configured Docker Compose for local development, provisioned the DigitalOcean Droplet, attached and mounted the Block Storage Volume with proper formatting, configured DigitalOcean monitoring and email alerts for CPU and disk thresholds.

Yaming Liu took primary ownership of the production orchestration and operational components while always collaborating closely with Dhruvi. He wrote the production Dockerfile and the complete docker-stack.yml with two API replicas, placement constraints pinning the database to the manager node, rolling-update settings, and restart policies. He implemented the health-check endpoints /health/alive and /health/db together with the flexible access-gate middleware supporting both JWT and API_KEY authentication. He designed and built the secure GitHub Actions CI/CD pipeline (Docker build, Docker Hub push using repository secrets, SSH deployment with stored private key, and zero-downtime docker stack deploy), created the full automated backup and recovery system (backup.sh, restore_latest.sh, nightly cron job, DigitalOcean Spaces bucket, and AWS CLI configuration), initialized Docker Swarm on the Droplet, performed all production deployments and rolling updates and persistence verification, and added the cAdvisor monitoring configuration.

Every feature was jointly tested and approved together, before the final commits. This close collaboration delivered a polished, production-ready VolunteerHub that runs reliably in the cloud and meets every course requirement.

## Lessons Learned and Concluding Remarks

This project turned out to be a valuable learning experience for us. Building and running a real stateful application in production taught us a lot.

A key lesson was how simple Docker Swarm is once you understand placement constraints and overlay networks. Getting the database to stay on the manager node with the attached volume took only one line in docker-stack.yml, yet it completely solved data persistence across redeployments. We now see why Swarm is perfect for small-to-medium production workloads instead of jumping straight to Kubernetes, especially for projects like VolunteerHub.

We also learned that real operational reliability comes from repetitive automation. Writing the tedious backup.sh and restore_latest.sh scripts helped us restore everything in under sixty seconds with one command, improving efficiency significantly. The same goes for the GitHub Actions pipeline as well, since we are able to update production automatically with zero downtime with every push (instead of SSHing and typing in docker stack deploy everytime).

Working without a frontend forced us to make the API extremely clean and well-documented, which was a good decision. Testing with Postman, Thunder Client, and curl is faster than any UI, and we now believe that building a solid, versioned REST API first is the right way to develop almost any full-stack project. We were also reminded that secrets management matters even for a course project, as taught in class. Using GitHub repository secrets for Docker Hub credentials and the Droplet SSH key, and never committing anything sensitive, made the CI/CD pipeline feel truly production-grade.

Finally, pair-programming often turned a time-consuming final project into something enjoyable. VolunteerHub started as a course requirement and ended up as something we are both genuinely proud of. It proved that with the technologies taught in ECE1779 (Docker, Compose, Swarm, PostgreSQL, persistent volumes, monitoring, CI/CD, and automated backups) it is entirely possible to build and operate a reliable, self-hosted production service on a single droplet. Thank you for the challenge, we learnt alot!

