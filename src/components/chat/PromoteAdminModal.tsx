'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/hooks/useAuth';
import { ApiService } from '@/lib/api';
import { ChatRoomDTO, ParticipantDTO, EnumRoomRole, EnumRoomType } from '@/types/chat';
import {
  XMarkIcon,
  UserIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

interface PromoteAdminModalProps {
  isOpen: boolean;
  chatRoom: ChatRoomDTO;
  onClose: () => void;
  onAdminPromoted: () => void;
}

export default function PromoteAdminModal({ 
  isOpen, 
  chatRoom, 
  onClose, 
  onAdminPromoted 
}: PromoteAdminModalProps) {
  const { user } = useAuth();
  const [participants, setParticipants] = useState<ParticipantDTO[]>([]);
  const [selectedParticipant, setSelectedParticipant] = useState<ParticipantDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const isProcessingRef = useRef(false); // Add ref to track processing state

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen && chatRoom) {
      loadParticipants();
      setSelectedParticipant(null);
      setError(null);
      isProcessingRef.current = false; // Reset processing flag
    }
  }, [isOpen, chatRoom]);

  // Improved click outside detection
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Don't close if we're processing or promoting
      if (isProcessingRef.current || promoting) {
        console.log('Ignoring click outside - operation in progress');
        return;
      }

      // Only close if the modal is open and the click is outside the modal content
      if (isOpen && modalRef.current && !modalRef.current.contains(event.target as Node)) {
        console.log('Clicked outside modal, closing');
        onClose();
      }
    };

    if (isOpen) {
      // Add a longer delay to prevent immediate closing
      const timeoutId = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 200);

      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen, onClose, promoting]);

  const loadParticipants = async () => {
    try {
      setLoading(true);
      setError(null);
      
    //   console.log('Loading participants for room:', chatRoom.id);
      const roomParticipants = await ApiService.getParticipantsByChatRoomId(chatRoom.id);
    //   console.log('All participants:', roomParticipants);
      
      const eligibleParticipants = roomParticipants.filter(
        p => p.userId !== user?.id && p.role === EnumRoomRole.MEMBER
      );
      
    //   console.log('Eligible participants for promotion:', eligibleParticipants);
      setParticipants(eligibleParticipants);
      
      if (eligibleParticipants.length === 0) {
        setError('No members available to promote. You cannot leave this group/channel as you are the only participant.');
      }
      
    } catch (error) {
      console.error('Failed to load participants:', error);
      setError('Failed to load participants');
    } finally {
      setLoading(false);
    }
  };

  const handleMemberSelect = (participant: ParticipantDTO, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    // Don't allow selection while processing
    if (isProcessingRef.current || promoting) {
      return;
    }
    
    // console.log('Selecting participant:', participant);
    setSelectedParticipant(participant);
    setError(null);
  };

  const handlePromote = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    // console.log('=== PROMOTE & LEAVE CLICKED ===');
    // console.log('Selected participant:', selectedParticipant);
    // console.log('User:', user);
    // console.log('Processing flag:', isProcessingRef.current);

    if (!selectedParticipant || !user) {
      setError('Please select a member to promote');
      return;
    }

    if (isProcessingRef.current || promoting) {
      console.log('Already processing, ignoring click');
      return;
    }

    try {
    //   console.log('Starting promotion process...');
      isProcessingRef.current = true; // Set processing flag FIRST
      setPromoting(true);
      setError(null);

    //   console.log('Calling API to promote participant...');
      await ApiService.updateParticipantRole(
        selectedParticipant.id,
        EnumRoomRole.ADMIN,
        user.id
      );

    //   await ApiService.removeParticipant(
    //     // Remove current user from the chat room
    //     chatRoom.participants.find(p => p.userId === user.id)!.id,
    //     user.id
    //   );

    //   console.log(`Successfully promoted ${selectedParticipant.fullName || selectedParticipant.username} to ADMIN`);

      // Short delay before triggering the callback
      setTimeout(() => {
        console.log('Calling onAdminPromoted callback...');
        onAdminPromoted();
      }, 500);

    } catch (error) {
    //   console.error('Failed to promote participant:', error);
      setError(error instanceof Error ? error.message : 'Failed to promote participant');
      isProcessingRef.current = false; // Reset on error
    } finally {
      setPromoting(false);
    }
  };

  const handleClose = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    // Don't allow closing while processing
    if (isProcessingRef.current || promoting) {
      console.log('Cannot close - operation in progress');
      return;
    }
    
    console.log('Manual close triggered');
    onClose();
  };

  // Don't render if not mounted or not open
  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onMouseDown={(e) => {
        // Only close if clicking directly on the backdrop
        if (e.target === e.currentTarget && !isProcessingRef.current && !promoting) {
          console.log('Backdrop clicked, closing modal');
          onClose();
        }
      }}
    >
      <div 
        ref={modalRef}
        className="bg-white rounded-lg w-full max-w-md max-h-[90vh] flex flex-col"
        onMouseDown={(e) => e.stopPropagation()} // Prevent backdrop clicks
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <ExclamationTriangleIcon className="w-6 h-6 text-amber-500" />
            <h2 className="text-xl font-semibold text-gray-900">Promote New Admin</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={isProcessingRef.current || promoting}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Warning Message */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-medium text-amber-800 mb-1">
                  You are the last admin
                </h4>
                <p className="text-sm text-amber-700">
                  Before leaving this {chatRoom.type === EnumRoomType.GROUP ? 'group' : 'channel'}, 
                  you must promote another member to admin. This ensures the {chatRoom.type === EnumRoomType.GROUP ? 'group' : 'channel'} can continue to be managed.
                </p>
              </div>
            </div>
          </div>

          {/* Processing Indicator */}
          {(isProcessingRef.current || promoting) && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                <span className="text-blue-800 text-sm font-medium">
                  {promoting ? 'Promoting admin...' : 'Processing...'}
                </span>
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
              <div className="text-gray-500 text-sm">Loading members...</div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* Debug Info */}
          <div className="text-xs text-gray-500">
            Debug: Found {participants.length} eligible participants | Selected: {selectedParticipant?.username || 'None'} | Processing: {isProcessingRef.current.toString()}
          </div>

          {/* Participants List */}
          {!loading && participants.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Select a member to promote to admin:
              </label>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {participants.map((participant) => (
                  <div
                    key={participant.id}
                    onMouseDown={(e) => handleMemberSelect(participant, e)}
                    className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors border-2 ${
                      selectedParticipant?.id === participant.id
                        ? 'bg-blue-50 border-blue-200 shadow-sm'
                        : 'bg-gray-50 border-transparent hover:bg-gray-100 hover:border-gray-200'
                    } ${(isProcessingRef.current || promoting) ? 'pointer-events-none opacity-50' : ''}`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                        <UserIcon className="w-6 h-6 text-gray-600" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">
                          {participant.fullName || participant.username}
                        </div>
                        <div className="text-sm text-gray-500">
                          @{participant.username}
                        </div>
                        <div className="text-xs text-gray-400 flex items-center">
                          <UserIcon className="w-3 h-3 mr-1" />
                          {participant.role}
                        </div>
                      </div>
                    </div>
                    
                    {selectedParticipant?.id === participant.id && (
                      <div className="flex items-center text-blue-600">
                        <ShieldCheckIcon className="w-5 h-5" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              {/* Selection Info */}
              {selectedParticipant && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center space-x-2 text-blue-800">
                    <ShieldCheckIcon className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      Selected: {selectedParticipant.fullName || selectedParticipant.username}
                    </span>
                  </div>
                  <p className="text-xs text-blue-600 mt-1">
                    This member will become the new admin when you leave.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* No Participants Message */}
          {!loading && participants.length === 0 && !error && (
            <div className="text-center py-8">
              <UserIcon className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-400 mb-2">No members to promote</h3>
              <p className="text-sm text-gray-400">
                You are the only participant in this {chatRoom.type === EnumRoomType.GROUP ? 'group' : 'channel'}. 
                The {chatRoom.type === EnumRoomType.GROUP ? 'group' : 'channel'} will be deleted when you leave.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
          <button
            onClick={handleClose}
            disabled={isProcessingRef.current || promoting}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onMouseDown={handlePromote} // Use onMouseDown instead of onClick
            disabled={!selectedParticipant || isProcessingRef.current || promoting || participants.length === 0}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
          >
            {(isProcessingRef.current || promoting) ? (
              <>
                <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2"></div>
                Promoting...
              </>
            ) : (
              <>
                <ShieldCheckIcon className="w-4 h-4 mr-2" />
                Promote & Leave
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}