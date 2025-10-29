/**
 * Create Template Page
 * 
 * Page for creating new onboarding templates.
 * Provides a form interface for HR admins to define template details and tasks.
 * 
 * @module pages/onboarding/CreateTemplatePage
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Paper,
  Button,
  Alert,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import TemplateForm from '../../components/onboarding/TemplateForm';
import { createTemplate } from '../../api/onboarding';

/**
 * Create Template Page Component
 */
const CreateTemplatePage: React.FC = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Handle form submission
   */
  const handleSubmit = async (data: any) => {
    try {
      setIsSubmitting(true);
      setError(null);

      // Transform form data to API format
      const templateData = {
        name: data.name,
        description: data.description,
        tasks: data.tasks.map((task: any, index: number) => ({
          title: task.title,
          description: task.description,
          daysUntilDue: task.dueDate,
          order: index + 1,
          requiresDocument: false,
        })),
      };

      await createTemplate(templateData);
      
      // Navigate back to dashboard on success
      navigate('/dashboard/hr-admin');
    } catch (err: any) {
      console.error('[CreateTemplatePage] Failed to create template:', err);
      setError(err.message || 'Failed to create template. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle cancel/back navigation
   */
  const handleCancel = () => {
    navigate('/dashboard/hr-admin');
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={handleCancel}
          sx={{ mb: 2 }}
        >
          Back to Dashboard
        </Button>
        
        <Typography variant="h4" component="h1" gutterBottom>
          Create Onboarding Template
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Define a new onboarding template with tasks for new employees
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <TemplateForm
        open={true}
        mode="create"
        onSuccess={handleSubmit}
        onClose={handleCancel}
      />
    </Container>
  );
};

export default CreateTemplatePage;
