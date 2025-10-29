/**
 * Edit Template Page
 * 
 * Page for editing existing onboarding templates.
 * Loads template data and provides form interface for updates.
 * 
 * @module pages/onboarding/EditTemplatePage
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Paper,
  Button,
  Alert,
  CircularProgress,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import TemplateForm from '../../components/onboarding/TemplateForm';
import { getTemplateById, updateTemplate } from '../../api/onboarding';

/**
 * Edit Template Page Component
 */
const EditTemplatePage: React.FC = () => {
  const navigate = useNavigate();
  const { templateId } = useParams<{ templateId: string }>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templateData, setTemplateData] = useState<any>(null);

  /**
   * Load template data on mount
   */
  useEffect(() => {
    const loadTemplate = async () => {
      if (!templateId) {
        setError('Template ID is required');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const data = await getTemplateById(templateId);
        setTemplateData(data);
      } catch (err: any) {
        console.error('[EditTemplatePage] Failed to load template:', err);
        setError(err.message || 'Failed to load template. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    loadTemplate();
  }, [templateId]);

  /**
   * Handle form submission
   */
  const handleSubmit = async (data: any) => {
    if (!templateId) {
      setError('Template ID is required');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      // Transform form data to API format
      const updatedTemplateData = {
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

      await updateTemplate(templateId, updatedTemplateData);
      
      // Navigate back to dashboard on success
      navigate('/dashboard/hr-admin');
    } catch (err: any) {
      console.error('[EditTemplatePage] Failed to update template:', err);
      setError(err.message || 'Failed to update template. Please try again.');
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

  if (isLoading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error && !templateData) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={handleCancel}
        >
          Back to Dashboard
        </Button>
      </Container>
    );
  }

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
          Edit Onboarding Template
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Update template details and tasks
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {templateData && (
        <TemplateForm
          open={true}
          mode="edit"
          initialData={{
            id: templateData.id,
            name: templateData.name,
            description: templateData.description,
            tasks: templateData.tasks.map((task: any) => ({
              title: task.title,
              description: task.description,
              dueDate: task.daysUntilDue,
            })),
          }}
          onSuccess={handleSubmit}
          onClose={handleCancel}
        />
      )}
    </Container>
  );
};

export default EditTemplatePage;
