# Onboarding API Documentation

## Overview

The Onboarding API provides endpoints for managing employee onboarding workflows, including template creation, workflow assignment, task tracking, and progress monitoring. All endpoints require authentication and enforce role-based access control.

**Base URL:** `/api/onboarding`

**Authentication:** Bearer token required in `Authorization` header

**Content Type:** `application/json` (except file uploads which use `multipart/form-data`)

---

## Table of Contents

1. [Authentication & Authorization](#authentication--authorization)
2. [Endpoints](#endpoints)
   - [Create Onboarding Template](#create-onboarding-template)
   - [Get Onboarding Templates](#get-onboarding-templates)
   - [Assign Onboarding Workflow](#assign-onboarding-workflow)
   - [Get My Onboarding Tasks](#get-my-onboarding-tasks)
   - [Update Task Status](#update-task-status)
   - [Get Team Onboarding Progress](#get-team-onboarding-progress)
3. [Data Models](#data-models)
4. [Error Responses](#error-responses)
5. [Workflow States](#workflow-states)
6. [Sequence Diagrams](#sequence-diagrams)

---

## Authentication & Authorization

### Authentication

All endpoints require a valid JWT access token in the `Authorization` header: