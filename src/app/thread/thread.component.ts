import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { Thread } from '../../models/thread.class';
import { User } from '../../models/user.class';
import { Conversation } from '../../models/conversation.class';
import { ConversationMessage } from '../../models/conversationMessage.class';
import { Channel } from '../../models/channel.class';
import { Reaction } from '../../models/reactions.class';
import { Observable } from 'rxjs';
import { DatabaseService } from '../database.service';
import { UserService } from '../user.service';
import { LastTwoEmojisService } from '../shared-services/chat-functionality/last-two-emojis.service';
import { TimeFormatingService } from '../shared-services/chat-functionality/time-formating.service';
import { MentionAndChannelDropdownService } from '../shared-services/chat-functionality/mention-and-channel-dropdown.service';
import { FileUploadService } from '../shared-services/chat-functionality/file-upload.service';
import { EditMessageService } from '../shared-services/chat-functionality/edit-message.service';
import { GeneralChatService } from '../shared-services/chat-functionality/general-chat.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ThreadMessage } from '../../models/threadMessage';
import { PickerModule } from '@ctrl/ngx-emoji-mart';
import { Timestamp } from 'firebase/firestore';
import { ChannelThread } from '../../models/channelThread.class';
import { ChannelMessage } from '../../models/channelMessage.class';
import { ChannelThreadMessage } from '../../models/channelThreadMessage';

@Component({
  selector: 'app-thread',
  standalone: true,
  imports: [CommonModule, FormsModule, PickerModule,],
  templateUrl: './thread.component.html',
  styleUrl: './thread.component.scss'
})
export class ThreadComponent {

  @Input() currentThread: Thread;
  @Input() specific: Conversation;
  @Input() user: User
  @Input() currentChannelThread: ChannelThread;
  @Input() channelThread: boolean;
  @Input() currentChannel: Channel
  @Output() emitReloadChannel = new EventEmitter<Channel>()
  @Output() emitReloadChat = new EventEmitter<boolean>()
  @Output() emitReloadToFalse = new EventEmitter<boolean>()
  @Output() emitCloseThread = new EventEmitter<string>();

  channelThreadMessageList: Array<ChannelThreadMessage> = [];
  conversationThreadMessagelist: Array<ThreadMessage> = [];
  allUsers = [] as Array<User>;
  allChannels: Array<Channel> = [];
  reactions: Array<Reaction> = [];
  channelMemberList: Array<User> = [];

  sendingUser: User;
  passiveUser: User;

  content = '';

  mainChannelMessage: ChannelMessage;
  mainMessage: ConversationMessage;

  isChatDataLoaded: boolean = false;

  fileUploadError: string | null = null;
  groupedReactionsThread: Map<string, Array<{ emoji: string, count: number, users: string[] }>> = new Map();
  userEmojis$: Observable<Array<string>>;

  @ViewChild('myTextarea') myTextarea!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('lastDiv') lastDiv: ElementRef<HTMLDivElement>;
  @ViewChild('fileInput') fileInput!: ElementRef;

  constructor(
    public databaseService: DatabaseService,
    public userService: UserService,
    private lastTwoEmojiService: LastTwoEmojisService,
    public time: TimeFormatingService,
    public mAndC: MentionAndChannelDropdownService,
    public fileUpload: FileUploadService,
    public edit: EditMessageService,
    public chat: GeneralChatService,
  ) {
    this.allChannels = mAndC.allChannels;
    this.allUsers = mAndC.allUsers;
    this.reactions = chat.reactionsThread;
    // this.chat.groupedReactionsThread$.subscribe(groupedReactionsThread => { this.groupedReactionsThread = groupedReactionsThread; });
    this.chat.groupedReactionsThread$.subscribe(groupedReactionsThread => { 
      this.groupedReactionsThread = groupedReactionsThread; 
      console.log('Subscribed groupedReactionsThread:', this.groupedReactionsThread);
    });
    
    
    const newContent = '';
    this.mAndC.contentThread.next(newContent);
    this.mAndC.contentThread.subscribe(newContent => {this.content = newContent;});
    this.handleFileUploadError();
    this.mAndC.getFocusTrigger().subscribe(() => {
      if (this.myTextarea) {this.myTextarea.nativeElement.focus();}
    });
    setTimeout(() => {this.loadAllMessages();}, 1000);
    this.fileUpload.downloadURLThread = '';
  }


  /**
   * loads member list for html if thread is opened by channel
   */
  loadMemberListForChannelThreadHTML(){
    if (this.channelThread) {
      this.loadMemberList();
    }
  }


  /**
   * opens the dialog to upload a file
   */
  triggerFileInput(): void {
    this.fileInput.nativeElement.click();
  }


  /**
   * handles the fileupload error
  */
  handleFileUploadError() {
      this.fileUpload.fileUploadError$.subscribe(error => {
        this.fileUploadError = error;
        setTimeout(() => {
          this.fileUploadError = null;
        }, 2500);
      });
  }


  /**
   * loads the mainmessage either from the channel or the conversation
   */
  loadMainMessage() {
    if (this.channelThread) {
      this.threadOpenedByChannel();
    }
    else {
      this.threadOpenedByConversation()
    }
  }


  /**
   * loads the main channelmessage
   */
  threadOpenedByChannel(){
    setTimeout(() => {
      this.databaseService.loadSpecificChannelMessage(this.user.userId, this.currentChannelThread.channelId, this.currentChannelThread.messageId)
        .then(message => {
          this.mainChannelMessage = message;
          this.isChatDataLoaded = true;
        })
        .catch(error => {
          console.error('Error loading message:', error);
        });
    }, 1000);
  }


  /**
   * loads the main conversationmessage
   */
  threadOpenedByConversation(){
    setTimeout(() => {
      this.databaseService.loadSpecificConversationMessage(this.user.userId, this.currentThread.conversationId, this.currentThread.messageId)
        .then(message => {
          this.mainMessage = message;
          this.isChatDataLoaded = true;
        })
        .catch(error => {
          console.error('Error loading message:', error);
        });
    }, 1000);
  }


  /**
   * loads all threadmessages from the conversation or channel mainmessage
   */
  loadAllMessages() {
    // debugger
    if (this.channelThread) {
      this.loadChannelThreadMessages()
    }
    else {
      this.loadConversationThreadMessages()
    }
  }


  /**
   * loads all threadmessages from the main channelmessage
   */
  loadChannelThreadMessages(){
    this.databaseService.loadChannelThreadMessages(this.currentChannelThread).then(messageList => {
      this.channelThreadMessageList = messageList;
      this.channelThreadMessageList.sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis());
    });
  }


  /**
   * loads all threadmessages from the main conversationmessage
   */
  loadConversationThreadMessages(){
    this.databaseService.loadThreadMessages(this.currentThread).then(messageList => {
      this.conversationThreadMessagelist = messageList;
      this.conversationThreadMessagelist.sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis());
    });
  }


  /**
   * loads threadmessage reactions depending on channelthreadmessage
   * or conversationthreadmessage
   */
  loadAllMessageReactions() {
    if (this.channelThread) {
      this.loadChannelThreadMessageReactions();
    }
    else {
      this.loadConversationThreadMessageReactions();
    }
  }


  /**
   * load threadmessage reactions from channelthreadmessage
   */
  loadChannelThreadMessageReactions(){
    this.reactions = [];
    for (let i = 0; i < this.channelThreadMessageList.length; i++) {
      const list = this.channelThreadMessageList[i];
      //TODO - neue Datenbankabfrage loadchannelThreadMessageReactions DONE!
      this.databaseService.loadChannelThreadMessageReactions(this.user.userId, this.currentChannel.channelId, list.messageId, list).then(reaction => {
        reaction.forEach(reaction => {
          this.reactions.push(reaction)
        });
      })
    }
  }


  /**
   * load threadmessage reactions from conversationthreadmessage
   */
  loadConversationThreadMessageReactions(){
    // debugger
    for (let i = 0; i < this.conversationThreadMessagelist.length; i++) {
      const list = this.conversationThreadMessagelist[i];
      //TODO - neue Datenbankabfrage loadConversationThreadMessageReactions
      this.databaseService.loadConversationThreadMessageReactions(this.user.userId, this.specific.conversationId, list.messageId, list).then(reaction => {
        reaction.forEach(reaction => {
          this.reactions.push(reaction)
        });
      })
    }
  }

//   async loadConversationThreadMessageReactions() {
//     const promises = this.conversationThreadMessagelist.map(list => 
//         this.databaseService.loadConversationThreadMessageReactions(this.user.userId, this.specific.conversationId, list.messageId, list)
//     );
    
//     const allReactions = await Promise.all(promises);
    
//     allReactions.forEach(reactionArray => {
//         this.reactions.push(...reactionArray);
//     });
    
//     this.chat.reactionsThread = [...this.reactions];  // Reactions an den Service übergeben
// }



  /**
   * updates a threadmessage from a conversation
   * @param message threadmessage object
   */
  updateMessage(message: ThreadMessage) {
    const updatedContent = this.edit.editContent;
    this.edit.isEditing = false;
    this.edit.selectedMessageIdEdit = null;
    message.content = updatedContent;
    this.databaseService.updateThreadMessage(message, this.specific).then(() => {
      console.log('Message updated successfully');
    }).catch(error => {
      console.error('Error updating message: ', error);
    });
    this.loadAllMessages();
}


/**
 * saves new thread message created by a conversation thread
 */
  async saveNewMessage() {
    if (this.content == '' && this.fileUpload.downloadURLThread == '') {
      this.displayEmptyContentError();
    } else {
      this.conversationThreadMessagelist = [];
      let newMessage: ThreadMessage = this.databaseService.createThreadMessage(this.specific, this.content, this.user.userId, this.currentThread, this.fileUpload.downloadURLThread)
      const timestamp: Timestamp = newMessage.createdAt;
      this.databaseService.addThreadMessage(this.currentThread, newMessage)
      this.resetContent();
      await this.databaseService.loadThreadMessages(this.currentThread).then(messageList => {
        this.conversationThreadMessagelist = messageList;
        this.conversationThreadMessagelist.sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis());
      })
      this.saveThreadCountAndtime(new ThreadMessage(newMessage), timestamp)
    }
}


/**
 * saves new thread message created by a channel thread
 */
async saveNewChannelThreadMessage() {
  if (this.content == '' && this.fileUpload.downloadURLThread == '') {
      this.displayEmptyContentError();
    } else {
      this.channelThreadMessageList = [];
      let newMessage: ChannelThreadMessage = this.databaseService.createChannelThreadMessage(this.currentChannel, this.content, this.user.userId, this.currentChannelThread, this.fileUpload.downloadURLThread)
      const timestamp: Timestamp = newMessage.createdAt;
      this.databaseService.addChannelThreadMessage(this.currentChannelThread, newMessage, this.currentChannel)
      this.resetContent();
      await this.databaseService.loadChannelThreadMessages(this.currentChannelThread).then(messageList => {
        this.channelThreadMessageList = messageList;
        this.channelThreadMessageList.sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis());
      })
      this.saveThreadCountAndtime(new ChannelThreadMessage(newMessage), timestamp)
    }
}


/**
 * resets content of new message
 */
resetContent(){
  this.content = '';
  const newContent = '';
  this.mAndC.contentThread.next(newContent);
}


/**
 * updates the thread with the new messages and displays it
 * @param newMessage threadmessage from channel or conversation
 * @param timestamp timestamp
 */
saveThreadCountAndtime(newMessage: ChannelThreadMessage | ThreadMessage, timestamp: Timestamp){
  if(newMessage instanceof ThreadMessage){
    const count: number = this.conversationThreadMessagelist.length;
    this.databaseService.updateMessageThreadCountAndThreadTime(newMessage, this.specific, count, timestamp)
    setTimeout(() => {this.scrollToBottom();}, 10);
    this.fileUpload.downloadURLThread = '';
    this.emitReloadChat.emit();
  }
  else{
    const count: number = this.channelThreadMessageList.length;
    this.databaseService.updateMessageChannelThreadCountAndThreadTime(newMessage, this.currentChannel, count, timestamp)
    setTimeout(() => {this.scrollToBottom();}, 10);
    this.fileUpload.downloadURLThread = '';
    this.emitReloadChannel.emit()
  }
}


/**
 * avoids sending empty messages
 */
displayEmptyContentError() {
  this.fileUploadError = 'Das abschicken von leeren Nachrichten ist nicht möglich';
  setTimeout(() => {
    this.fileUploadError = null;
    console.log(this.fileUploadError);
  }, 2500);
};


/**
 * Scroll to the bottom of the chatarea 
 */
scrollToBottom(): void {
  try {
    if(this.conversationThreadMessagelist.length > 0) {
      this.lastDiv.nativeElement.scrollIntoView();
    }
  } catch (err) {
    console.error('Scroll to bottom failed', err);
  }
}


/**
 * loads the memberlist of the channel need for the HTML
 * @returns  promise 
 */
async loadMemberList(): Promise < void> {
  this.channelMemberList = [];
  const memberPromises = this.currentChannel.membersId.map(member => {
    this.databaseService.loadUser(member)
      .then(user => {
        this.channelMemberList.push(user);
      })
  });
  return Promise.all(memberPromises).then(() => {
  });
}


/**
 * updates a threadmessage from a channel
 * @param message channelthreadmessage object
 */
updateChannelThreadMessage(message: ChannelThreadMessage){
  const updatedContent = this.edit.editContent;
  this.edit.isEditingThread = false;
  this.edit.selectedMessageIdEdit = null;
  message.content = updatedContent;
  this.databaseService.updateChannelThreadMessage(message, this.currentChannel)
  this.loadAllMessages();
}


/**
 * reloads channel and chat threadmessages and loads html information
 *  after a change
 */
ngOnChanges() {
  this.loadMainMessage();
  setTimeout(() => {
    this.loadAllMessages();
  }, 1000);
  setTimeout(async () => {
    await this.loadAllMessageReactions();
    this.chat.groupReactionsThread(this.conversationThreadMessagelist);
  }, 2000);
  this.chat.groupedReactionsThread$.subscribe(groupedReactionsThread => {this.groupedReactionsThread = groupedReactionsThread;});

  if (!this.channelThread) {
    this.loadingPassiveUserConversationWithSelf()
    this.loadingPassiveUserFromCreatorUser();
    this.loadingPassiveUserFromRecipientUser();
  }
  else{
    this.loadMemberListForChannelThreadHTML();
  }
}


/**
 * defining passiveUser if specific = ConversationWithSelf
 */
loadingPassiveUserConversationWithSelf(){
    if (this.specific.createdBy == this.specific.recipientId) {
      this.databaseService.loadUser(this.specific.createdBy)
        .then(creatorUser => {
          if (creatorUser.userId == this.user.userId) {
            this.passiveUser = creatorUser;
          }
        })
    }
}


/**
 * defining passiveUser if user is creator
 */
loadingPassiveUserFromCreatorUser(){
  this.databaseService.loadUser(this.specific.createdBy)
  .then(creatorUser => {
    if (creatorUser.userId == this.user.userId) {
      this.sendingUser = creatorUser;
    }
    else {
      this.passiveUser = creatorUser;
    }
  })
}


/**
 * defining passiveUser if user is recipient
 */
loadingPassiveUserFromRecipientUser(){
  this.databaseService.loadUser(this.specific.recipientId)
  .then(recipientUser => {
    if (recipientUser.userId == this.user.userId) {
      this.sendingUser = recipientUser;
    }
    else {
      this.passiveUser = recipientUser;
    }
  })
}


/**
 * closes the currently opened thread
 */
closeThread(){
  //debugger
  this.emitCloseThread.emit()
  
  //TEST for DATABASE QUERY
  // this.reactions = []
  // for (let i = 0; i < this.channelThreadMessageList.length; i++) {
  //   const list = this.channelThreadMessageList[i];
  //   this.databaseService.loadChannelThreadMessageReactions(this.user.userId, this.currentChannel.channelId, list.messageId, list).then(reaction => {
  //     reaction.forEach(reaction => {
  //       this.reactions.push(reaction)
  //       console.log(`reactions nach Durchlauf ${i}:`, this.reactions)
  //     });
  //   })
  // }

}


/**
 * ADDS REACTION TO THREADMESSAGES OF A CONVERSATION MESSAGE
 * @param event selection of the emoji through emoji picker
 * @param convo conversationthreadmessageobject
 * @param userId id of user
 * @param reactionbar has a value if emoji is selected from reactionbar
 * @returns 
 */
async saveNewMessageReaction(event: any, convo: ThreadMessage, userId: string, reactionbar?: string) {
  // debugger
  let emoji: string =  this.selectEmoji(reactionbar, event)
  if (this.checkUserAlreadyReacted(convo, emoji, userId)) {console.log('User has already reacted with this emoji'); 
    return;
  }

  //specific to conversation thread message
  this.reactions = [];
  let reaction = this.databaseService.createThreadMessageReaction(emoji, userId, this.user.name, convo);
  await this.databaseService.addThreadMessageReaction(this.specific, convo, reaction)
  await this.loadAllMessageReactions();
  this.chat.reactionsThread = this.reactions
  setTimeout(() => {this.chat.groupReactionsThread(this.conversationThreadMessagelist)}, 500);
  //END specific of conversation thread message

  this.chat.checkIfEmojiIsAlreadyInUsedLastEmojis(this.user, emoji, userId);
  this.mAndC.loadUsersOfUser();
  this.mAndC.loadChannlesofUser()
  this.mAndC.selectedMessageId = null;
}


/**
 * ADDS REACTION TO THREADMESSAGES OF A CHANNEL MESSAGE
 * @param event selection of the emoji through emoji picker
 * @param convo channelthreadmessageobject
 * @param userId id of user
 * @param reactionbar has a value if emoji is selected from reactionbar
 * @returns 
 */
async saveNewChannelMessageReaction(event: any, convo: ChannelThreadMessage, userId: string, reactionbar ?: string) {
  // debugger
  console.log(this.reactions);
  
  let emoji: string =  this.selectEmoji(reactionbar, event)
  if (this.checkUserAlreadyReacted(convo, emoji, userId)) {console.log('User has already reacted with this emoji');
    return;
  }


  //specific to conversation thread message
  this.reactions = [];
  let reaction = this.databaseService.createChannelThreadMessageReaction(emoji, userId, this.user.name, convo);
  await this.databaseService.addChannelThreadMessageReaction(this.currentChannel, convo, reaction)
  await this.loadAllMessageReactions();


  //TODO - Versuchsbereich um das Thread Emoji Problem zu lösen mit chatservice
  // reactions der ThreadNachricht werden korrekt geladen. Es werden grundsätzlich keine Emojis
  // im Thread angezeigt, da Sie durch das auskommentieren von Zeile 102 ausgeschaltet wurden
  // um die doppelte Anzeige der Emojis zu verhindern

  // for (let i = 0; i < this.channelThreadMessageList.length; i++) {
  //   const list = this.channelThreadMessageList[i];
  //   this.databaseService.loadChannelThreadMessageReactions(this.user.userId, this.currentChannel.channelId, list.messageId, list).then(reaction => {

  //     reaction.forEach(reaction => {
  //       this.reactions.push(reaction)
  //          console.log(`reactions nach Durchlauf ${i}:`, this.reactions)
  //     });

  //   }).then(()=> {
  //     debugger;
  //     this.chat.checkIfEmojiIsAlreadyInUsedLastEmojis(this.user, emoji, userId);
  //     this.mAndC.loadUsersOfUser();
  //     this.mAndC.loadChannlesofUser()
  //     this.mAndC.selectedMessageId = null;
  //     this.chat.reactions = this.reactions //überschreib die gefundene reactions wieder auf 0
  //     console.log(this.channelThreadMessageList)
  //     setTimeout(() => {
  //       this.chat.groupReactions(this.channelThreadMessageList) //Wird auf die ChannelNachricht angewandt und nicht auf die ThreadNachricht
  //     }, 1000);
        
  //   })
  // }

  //END specific of conversation thread message


}


/**
 * gives the variable the value of the selected emoji
 * @param reactionbar has a value if emoji is selected from reactionbar
 * @param event selection of the emoji through emoji picker
 * @returns 
 */
selectEmoji(reactionbar: string | undefined, event: any): string{
  let emoji: string
  if (reactionbar) {
    emoji = reactionbar
    return emoji;
  } else {
    emoji = event.emoji.native
    return emoji;
  }
}


/**
 * checks if the user already reacted with the emoji to the thread or channelmessage
 * @param convo Threadmessageobject or Channelthreadmessageobject
 * @param emoji selected emoji
 * @param userId is of user
 * @returns boolean
 */
checkUserAlreadyReacted(convo: ThreadMessage | ChannelThreadMessage, emoji: string, userId: string): boolean {
  return this.reactions.some(reaction =>
    reaction.messageId === convo.messageId && reaction.emoji === emoji && reaction.userId === userId
  );
}




}
