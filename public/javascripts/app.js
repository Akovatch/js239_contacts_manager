class Model {
  constructor() {
    this.contacts = [];
  }

  async fetchAllContacts() {
    return fetch("http://localhost:3000/api/contacts/")
    .then(response => response.ok ? response.json() : Promise.reject())
    .then(data => this.contacts = this.processAPIData(data))
    .catch(error => error);
  }

  getContacts() {
    return this.contacts;
  }

  async submitContact(event) {
    event.preventDefault();
    let form = event.target;
    let method;
    let queryData;

    if (form.id === 'add_form') {
      method = 'POST';
      let formData = this.processTags(new FormData(form), form);
      queryData = new URLSearchParams(formData).toString();
    } else {
      method = 'PUT';
      let formData = this.processTags(new FormData(form), form);
      queryData = new URLSearchParams(this.processPutRequestData(formData, form)).toString();
    }

    return fetch(form.action, {
      method,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: queryData,
    }).then(res => res.ok ? true : false)
    .catch(error => error);
  }

  async deleteContact(id) {
    let url = `http://localhost:3000/api/contacts/${id}`

    return fetch(url, {
      method: 'DELETE',
    }).then(res => res.ok ? true : false)
    .catch(error => error);
  }

  processAPIData(data) {
    for (let obj of data) {
      if (obj.tags) {obj.tags = obj.tags.split(',')}
      }

    return data;
  }

  processTags(formData, form) {
    let tags = form.querySelector('ul').dataset.tags;
    formData.set('tags', tags);
    return formData;
  }

  processPutRequestData(formData, form) {
    let id = form.action.split('/').slice(-1);
    let previousData = this.contacts.find(obj => obj.id === Number(id));

    let uniqueValues = {};

    for (let field of formData.entries()) {
      let key = field[0];
      let value = field[1];
      if (previousData[key] !== value) {
        uniqueValues[key] = value;
      }
    }

    return uniqueValues;
  }

  getSingleContact(id) {
    return this.contacts.find(contact => {
      return contact.id === Number(id);
    })
  }
}


class Controller {
  constructor(model, view) {
    this.model = model;
    this.view = view;
    this.bindEventListeners();
    this.refreshContactsPage();
  }

  bindEventListeners() {
    document.addEventListener('click', this.handleClickEvents.bind(this));
    document.getElementById('add_form').addEventListener('submit', this.handleSubmitForm.bind(this));
    document.getElementById('edit_form').addEventListener('submit', this.handleSubmitForm.bind(this));
    document.getElementById('search_bar').addEventListener('keyup', this.debounce(this.handleSearch.bind(this), 300));
    document.addEventListener('focusout', this.handleFieldValidation.bind(this));
    document.addEventListener('focusin', this.view.removeValidationMessage.bind(this.view));
    document.addEventListener('keydown', this.handleKeydownValidation);
  }

  handleClickEvents(event) {
    let target = event.target;

    if (target.id === 'add_btn') {
      this.handleAddEvent.call(this);
    } else if (target.classList.contains('edit_btn')) {
      this.handleEditEvent.call(this, target);
    } else if (target.classList.contains('delete_btn')) {
      this.handleDeleteEvent.call(this, target);
    } else if (target.classList.contains('cancel_btn')) {
      this.view.hideForm(target);
    } else if (target.classList.contains('add_tag_btn')) {
      this.view.addTagToForm(target);
    } else if (target.classList.contains('delete_tag_btn')) {
      this.view.deleteTagFromForm(target);
    } else if (target.tagName === 'A') {
      this.handleTagFiltering(event);
    } else if (target.classList.contains('see_all_contacts')) {
      this.handleSeeAllContacts(event);
    }
  }

  async handleSubmitForm(event) {
    event.preventDefault();
    let form = event.target;

    if (!form.reportValidity() && !form.querySelector('#form_error_message')) {
      this.view.addFormErrorMessage(form);
      return;
    } else if (!form.reportValidity()) {
      return;
    }

    try {
      let result = await this.model.submitContact(event);
      if (!result) {
        throw new Error(`Error: Form could not be submitted.`);
      } else {
        alert(`Contact was successfully ${form.id === 'add_form' ? 'added' : 'saved'}.`)
        this.view.hideForm(form);
        this.refreshContactsPage();
      }

    } catch (err) {
      console.log(err.message);
    }
  }

  handleAddEvent(event) {
    this.view.displayAddContactForm();
  }

  handleEditEvent(target) {
    let id = target.closest('li').dataset.id;
    let contact = this.model.getSingleContact(id);
    this.view.renderEditForm(contact);
  }

  async handleDeleteEvent(target) {
    if (!window.confirm("Are you sure you want to delete contact?")) { return }
    let id = target.closest('li').dataset.id;

    try {
      let result = await this.model.deleteContact(id);
      if (!result) {
        throw new Error('Error: Contact could not be deleted.');
      } else {
        this.refreshContactsPage();
      }

    } catch (err) {
      console.log(err.message);
    }
  }

  handleSearch(event) {
    let searchValue = event.target.value;

    if (searchValue === '') {
      this.view.renderContacts(this.model.getContacts());
      return;
    }

    let contacts = this.model.contacts.filter(contact => {
      return contact.full_name.toLowerCase().startsWith(searchValue.toLowerCase());
    })

    this.view.renderContacts(contacts, true)
  }

  handleTagFiltering(event) {
    event.preventDefault()
    let tagValue = event.target.textContent;

    let contacts = this.model.contacts.filter(contact => {
      return contact.tags && contact.tags.includes(tagValue);
    })

    this.view.renderSeeAllButton();
    this.view.renderContacts(contacts);
  }

  handleSeeAllContacts() {
    this.view.removeSeeAllButton();
    this.view.renderContacts(this.model.contacts);
  }

  async refreshContactsPage() {
    try {
      let result = await this.model.fetchAllContacts();

      if (!result) {
        throw new Error('Error: Contacts could not be retrieved.');
      } else {
        this.view.renderContacts(this.model.getContacts());
      }

    } catch (err) {
      console.log(err.message);
    }
  }

  handleFieldValidation(event) {
    let target = event.target;
    if (target.tagName !== 'INPUT' || target.id === 'search_bar') { return }
    this.view.validateInput(target)
  }

  handleKeydownValidation(event) {
    let key = event.key
    if (key === 'Backspace') { return }
    let field = document.activeElement;

    if (field.name === 'full_name' && !/[a-z' ]+/i.test(key)) {
      event.preventDefault()
    } else if (field.name === 'phone_number' && !/[0-9\-]+/.test(key)) {
      event.preventDefault()
    } else if (field.name === 'email' && /[ ]+/i.test(key)) {
      event.preventDefault()
    } else if (field.classList.contains('tag_input') && (key === ',' || key === ' ')) {
      event.preventDefault()
    }
  }

  debounce(func, delay) {
    let timeout;
    return (...args) => {
      if (timeout) { clearTimeout(timeout) }
      timeout = setTimeout(() => func.apply(null, args), delay);
    };
  };
}

class View {
  constructor() {
    this.compileTemplates();
    this.contactList = document.getElementById('contacts_list')
    this.addModal = document.getElementById('add_contact_modal');
    this.editModal = document.getElementById('edit_contact_modal');
    this.addForm = document.getElementById('add_form');
    this.editForm = document.getElementById('edit_form');
    this.modalLayer = document.getElementById('modal_layer');
  }

  renderContacts(contacts, search_status) {
    if (contacts.length > 0) {
      this.contactList.innerHTML = this.template({contacts: contacts});
    } else if (contacts.length === 0 && search_status) {
      this.contactList.innerHTML = '<h2 id="no_contacts">Search returned no contacts.</h2>';
    } else {
      this.contactList.innerHTML = '<h2 id="no_contacts">There are no contacts.</h2>';
    }
  }

  displayAddContactForm() {
    this.modalLayer.classList.replace('hide', 'show');
    this.addModal.classList.replace('hide', 'show');
  }

  renderEditForm(contact) {
    let editForm = document.getElementById('edit_form');
    let fields = editForm.querySelectorAll('[type="text"]');

    fields.forEach(field => {
      if (!field.classList.contains('tag_input')) { field.value = contact[field.name] }
    })

    let tagUL = document.getElementById('edit_tags_ul');
    let tags = contact.tags;

    if (tags) {
      tagUL.dataset.tags = tags.join(',');
      tags.forEach(tag => this.displayTag(tagUL, tag))
    } else {
      tagUL.dataset.tags = '';
    }

    editForm.action = `http://localhost:3000/api/contacts/${contact.id}`;
    this.editModal.classList.replace('hide', 'show');
    this.modalLayer.classList.replace('hide', 'show');
  }

  compileTemplates() {
    Handlebars.registerPartial('partial', document.getElementById('partial').innerHTML);
    this.template = Handlebars.compile(document.getElementById('template').innerHTML);
  }

  hideForm(target) {
    let form = target.tagName !== 'FORM' ? target.closest('form') : target;

    if (form.id === 'add_form') {
      this.addModal.classList.replace('show', 'hide');
    } else {
      this.editModal.classList.replace('show', 'hide');
    }

    this.modalLayer.classList.replace('show', 'hide');

    setTimeout(() => {
      form.reset();
      this.removeErrorMessages();
      document.getElementById('add_tags_ul').textContent = '';
      document.getElementById('edit_tags_ul').textContent = '';
    }, 1000);
  }

  addTagToForm(target) {
    if (target.previousElementSibling.value === '') { return }
    let tagUL = target.nextElementSibling
    let tags = tagUL.dataset.tags.match(/[a-z0-9]+/gi) || [];
    let tagValue = target.previousElementSibling.value;
    if (tags.includes(tagValue)) {
      alert(`"${tagValue}" already exists as a tag on this contact.`);
      return
    }

    tags.push(tagValue)
    this.displayTag(tagUL, tagValue)
    tagUL.dataset.tags = tags.join(',');
    target.previousElementSibling.value = '';
  }

  displayTag(tagUL, tagValue) {
    let tagLI = document.createElement('li');
    tagLI.innerHTML = `${tagValue} <button class="delete_tag_btn">x</button>`;
    tagUL.appendChild(tagLI);
  }

  deleteTagFromForm(target) {
    let tagUL = target.closest('ul');
    let tagValue = target.previousSibling.data.trim();
    let tags = tagUL.dataset.tags.match(/[a-z0-9]+/gi) || [];
    tags.splice(tags.indexOf(tagValue), 1);
    tagUL.dataset.tags = tags.join(',');
    target.closest('li').remove();
  }

  renderSeeAllButton() {
    let addButton = document.getElementById('add_btn')
    if (addButton.nextElementSibling.tagName === 'BUTTON') { return }
    let button = document.createElement('button');
    button.textContent = 'See All Contacts'
    button.classList.add('see_all_contacts')
    addButton.insertAdjacentElement('afterend', button);
  }

  removeSeeAllButton() {
    document.querySelector('.see_all_contacts').remove();
  }

  validateInput(field) {
    if (field.validity.valueMissing) {
      this.displayErrorMessage(field, ' is a required field.');
      field.classList.add('invalid');
    } else if (field.validity.patternMismatch) {
      this.displayErrorMessage(field, ' is not valid.');
      field.classList.add('invalid');
    } else {
      field.classList.remove('invalid');
      if (field.nextElementSibling && field.nextElementSibling.classList.contains('error_message')) {
        field.nextElementSibling.remove()
      }
    }
  }

  displayErrorMessage(field, message) {
    if (field.nextElementSibling && field.nextElementSibling.tagName === 'SPAN') { return }
    let span = document.createElement('span');
    span.classList.add('error_message');
    span.textContent = this.convertFieldName(field.name) + message;
    field.insertAdjacentElement('afterend', span);
  }

  removeErrorMessages() {
    document.querySelectorAll('.error_message').forEach(span => span.remove())
    document.querySelectorAll('.invalid').forEach(field => field.classList.remove('invalid'))
    if (document.getElementById('form_error_message')) { document.getElementById('form_error_message').remove() }
  }

  convertFieldName(string) {
    if (string.includes('_')) {
      return string.split('_').map(word => word[0].toUpperCase() + word.slice(1)).join(' ');
    } else {
      return string[0].toUpperCase() + string.slice(1);
    }
  }

  addFormErrorMessage(form) {
    let span = document.createElement('span');
    span.textContent = "Fix errors before submitting this form.";
    span.id = "form_error_message";
    form.insertAdjacentElement('afterbegin', span);
  }

  removeValidationMessage(event) {
    if (event.target.tagName !== 'INPUT') { return }
    let input = event.target;
    let sibling = input.nextElementSibling;
    if (sibling && sibling.classList.contains('error_message')) {
      sibling.remove();
    }
  }
}

document.addEventListener('DOMContentLoaded', event => {
  let controller = new Controller(new Model, new View);
})
