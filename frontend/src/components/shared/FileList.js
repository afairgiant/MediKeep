import React, { useState } from 'react';
import {
  Stack,
  Paper,
  Group,
  Text,
  ActionIcon,
  ThemeIcon,
  Badge,
  Select,
  TextInput,
  Divider,
  Alert
} from '@mantine/core';
import {
  IconDownload,
  IconTrash,
  IconRestore,
  IconFile,
  IconFileText,
  IconPhoto,
  IconSearch,
  IconSortAscending,
  IconSortDescending
} from '@tabler/icons-react';
import { formatDate } from '../../utils/helpers';

const FileList = ({
  files = [],
  filesToDelete = [],
  showActions = true,
  showDescriptions = true,
  onDownload,
  onDelete,
  onPreview,
  onRestore,
  className = ''
}) => {
  const [sortBy, setSortBy] = useState('uploaded_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterByType, setFilterByType] = useState('');

  // Get file icon and color based on type
  const getFileIcon = (fileName, fileType) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    const mimeType = fileType?.toLowerCase();

    if (mimeType?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff'].includes(extension)) {
      return { icon: IconPhoto, color: 'blue' };
    }
    
    if (extension === 'pdf' || mimeType === 'application/pdf') {
      return { icon: IconFile, color: 'red' };
    }
    
    if (['doc', 'docx'].includes(extension) || mimeType?.includes('word')) {
      return { icon: IconFileText, color: 'blue' };
    }
    
    if (['xls', 'xlsx'].includes(extension) || mimeType?.includes('excel')) {
      return { icon: IconFileText, color: 'green' };
    }
    
    return { icon: IconFile, color: 'gray' };
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown size';
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Filter and sort files
  const processedFiles = React.useMemo(() => {
    let filtered = [...files];

    // Apply search filter
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(file => 
        file.file_name?.toLowerCase().includes(lowerSearchTerm) ||
        file.description?.toLowerCase().includes(lowerSearchTerm)
      );
    }

    // Apply type filter
    if (filterByType) {
      filtered = filtered.filter(file => {
        const extension = file.file_name?.split('.').pop()?.toLowerCase();
        return extension === filterByType.toLowerCase();
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'file_name':
          aValue = a.file_name?.toLowerCase() || '';
          bValue = b.file_name?.toLowerCase() || '';
          break;
        case 'file_size':
          aValue = a.file_size || 0;
          bValue = b.file_size || 0;
          break;
        case 'uploaded_at':
          aValue = new Date(a.uploaded_at || 0);
          bValue = new Date(b.uploaded_at || 0);
          break;
        case 'file_type':
          aValue = a.file_type?.toLowerCase() || '';
          bValue = b.file_type?.toLowerCase() || '';
          break;
        default:
          aValue = '';
          bValue = '';
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }, [files, searchTerm, filterByType, sortBy, sortOrder]);

  // Get unique file types for filter dropdown
  const fileTypes = React.useMemo(() => {
    const types = files.map(file => file.file_name?.split('.').pop()?.toLowerCase()).filter(Boolean);
    return [...new Set(types)].sort();
  }, [files]);

  // Toggle sort order
  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  if (files.length === 0) {
    return (
      <Paper withBorder p="md" ta="center" className={className}>
        <Stack align="center" gap="sm">
          <ThemeIcon size="xl" variant="light" color="gray">
            <IconFile size={24} />
          </ThemeIcon>
          <Text c="dimmed">No files attached</Text>
        </Stack>
      </Paper>
    );
  }

  return (
    <Stack gap="md" className={className}>
      {/* Filters and Search */}
      <Paper withBorder p="sm">
        <Group gap="md" align="flex-end">
          <TextInput
            placeholder="Search files..."
            leftSection={<IconSearch size={16} />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ flex: 1 }}
          />
          
          <Select
            placeholder="Filter by type"
            data={[
              { value: '', label: 'All types' },
              ...fileTypes.map(type => ({ value: type, label: type.toUpperCase() }))
            ]}
            value={filterByType}
            onChange={(value) => setFilterByType(value || '')}
            clearable
            style={{ minWidth: 120 }}
          />
          
          <Select
            placeholder="Sort by"
            data={[
              { value: 'uploaded_at', label: 'Upload Date' },
              { value: 'file_name', label: 'Name' },
              { value: 'file_size', label: 'Size' },
              { value: 'file_type', label: 'Type' }
            ]}
            value={sortBy}
            onChange={(value) => setSortBy(value || 'uploaded_at')}
            style={{ minWidth: 120 }}
          />
          
          <ActionIcon
            variant="light"
            onClick={toggleSortOrder}
            title={`Sort ${sortOrder === 'asc' ? 'ascending' : 'descending'}`}
          >
            {sortOrder === 'asc' ? <IconSortAscending size={16} /> : <IconSortDescending size={16} />}
          </ActionIcon>
        </Group>
      </Paper>

      {/* Files List */}
      <Stack gap="sm">
        {processedFiles.length === 0 ? (
          <Alert color="gray" variant="light">
            No files match your search criteria.
          </Alert>
        ) : (
          processedFiles.map((file) => {
            const { icon: FileIcon, color } = getFileIcon(file.file_name, file.file_type);
            const isMarkedForDeletion = filesToDelete.includes(file.id);
            
            return (
              <Paper
                key={file.id}
                withBorder
                p="md"
                bg={isMarkedForDeletion ? 'red.0' : 'white'}
                style={{
                  opacity: isMarkedForDeletion ? 0.7 : 1,
                  borderColor: isMarkedForDeletion ? 'var(--mantine-color-red-3)' : undefined,
                }}
              >
                <Group justify="space-between" align="flex-start">
                  <Group gap="md" style={{ flex: 1 }}>
                    <ThemeIcon variant="light" color={color}>
                      <FileIcon size={20} />
                    </ThemeIcon>
                    
                    <Stack gap="xs" style={{ flex: 1 }}>
                      {/* File name and metadata */}
                      <Group gap="md" align="flex-start">
                        <Stack gap={2} style={{ flex: 1 }}>
                          <Text fw={500} size="sm">
                            {file.file_name}
                          </Text>
                          <Group gap="md">
                            <Text size="xs" c="dimmed">
                              {formatFileSize(file.file_size)}
                            </Text>
                            {file.file_type && (
                              <Badge variant="light" color="gray" size="xs">
                                {file.file_type}
                              </Badge>
                            )}
                            {file.uploaded_at && (
                              <Text size="xs" c="dimmed">
                                {formatDate(file.uploaded_at)}
                              </Text>
                            )}
                          </Group>
                        </Stack>
                        
                        {isMarkedForDeletion && (
                          <Badge color="red" size="sm">
                            Marked for deletion
                          </Badge>
                        )}
                      </Group>
                      
                      {/* Description */}
                      {showDescriptions && file.description && (
                        <>
                          <Divider />
                          <Text size="sm" c="dimmed" fs="italic">
                            {file.description}
                          </Text>
                        </>
                      )}
                    </Stack>
                  </Group>
                  
                  {/* Actions */}
                  {showActions && (
                    <Group gap="xs" style={{ flexShrink: 0 }}>
                      {onDownload && (
                        <ActionIcon
                          variant="light"
                          color="blue"
                          onClick={() => onDownload(file.id, file.file_name)}
                          title="Download file"
                        >
                          <IconDownload size={16} />
                        </ActionIcon>
                      )}
                      
                      {onPreview && (
                        <ActionIcon
                          variant="light"
                          color="green"
                          onClick={() => onPreview(file)}
                          title="Preview file"
                        >
                          <IconFile size={16} />
                        </ActionIcon>
                      )}
                      
                      {onDelete && !isMarkedForDeletion && (
                        <ActionIcon
                          variant="light"
                          color="red"
                          onClick={() => onDelete(file.id)}
                          title="Delete file"
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      )}
                      
                      {onRestore && isMarkedForDeletion && (
                        <ActionIcon
                          variant="light"
                          color="green"
                          onClick={() => onRestore(file.id)}
                          title="Restore file"
                        >
                          <IconRestore size={16} />
                        </ActionIcon>
                      )}
                    </Group>
                  )}
                </Group>
              </Paper>
            );
          })
        )}
      </Stack>
      
      {/* Summary */}
      {processedFiles.length > 0 && (
        <Paper withBorder p="sm" bg="gray.0">
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Showing {processedFiles.length} of {files.length} files
            </Text>
            {filesToDelete.length > 0 && (
              <Text size="sm" c="red">
                {filesToDelete.length} file{filesToDelete.length !== 1 ? 's' : ''} marked for deletion
              </Text>
            )}
          </Group>
        </Paper>
      )}
    </Stack>
  );
};

export default FileList;